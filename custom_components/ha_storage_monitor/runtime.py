"""Serialized backend lifecycle and durable history, independent of HA imports.

HA supplies an executor-backed sampler and Store.async_save. Reads never sample
or save. Store failure is latched for this runtime; stop never flushes an empty
replacement. An acknowledged async_save is not a claim of hardware fsync.
"""
from __future__ import annotations

import asyncio
import copy
import math
import time
from uuid import uuid4

from .model import History, Sample, ValidationError, dump_store, forecast, history_window, load_store

MAX_SOURCES = 32
MAX_STORED_SOURCES = 64
MAX_FAILURES = 128
SAMPLE_SECONDS = 1800


class RuntimeUnavailable(Exception):
    """Sanitized machine-readable failure, safe for API and native sensors."""


class StorageRuntime:
    """Owns source segments, bounded histories and the single persistence writer."""

    def __init__(self, bindings, sampler, save, *, clock=time.time):
        if not isinstance(bindings, (tuple, list)) or not 1 <= len(bindings) <= MAX_SOURCES:
            raise ValueError("invalid_source_bindings")
        self.bindings = copy.deepcopy(bindings)
        identifiers = set()
        for binding in self.bindings:
            for key in ("source_uuid", "binding_revision", "mountpoint"):
                if not isinstance(binding.get(key), str) or not 0 < len(binding[key]) <= 512:
                    raise ValueError("invalid_source_binding")
            if binding["source_uuid"] in identifiers or not binding["mountpoint"].startswith("/"):
                raise ValueError("ambiguous_source_binding")
            identifiers.add(binding["source_uuid"])
        self._sampler, self._save, self._clock = sampler, save, clock
        self._lock = asyncio.Lock()
        self._active = False
        self._storage_error = False
        self._histories = {}
        self._failures = {}
        self._current, self._errors, self._identities, self._attempts = {}, {}, {}, {}
        self._segments = {source: uuid4().hex for source in identifiers}

    def _require_active(self):
        if self._storage_error:
            raise RuntimeUnavailable("storage_error")
        if not self._active:
            raise RuntimeUnavailable("integration_unloaded")

    async def start(self, payload, *, file_exists):
        """Validate the complete existing file before allowing any samples/writes."""
        if self._active or self._storage_error:
            raise RuntimeUnavailable("already_initialized")
        try:
            now = self._clock()
            if file_exists:
                if (not isinstance(payload, dict) or set(payload) != {"version", "history", "failures"}
                        or type(payload["version"]) is not int or payload["version"] != 1):
                    raise ValidationError("invalid_store_envelope")
                histories = load_store(payload["history"], now=now)
                if len(histories) > MAX_STORED_SOURCES:
                    raise ValidationError("stored_source_limit")
                failures = payload["failures"]
                if not isinstance(failures, dict) or len(failures) > MAX_STORED_SOURCES:
                    raise ValidationError("invalid_failures")
                for source, rows in failures.items():
                    if not isinstance(source, str) or source not in histories or not isinstance(rows, list) or len(rows) > MAX_FAILURES:
                        raise ValidationError("invalid_failures")
                    previous = -1
                    for row in rows:
                        if not isinstance(row, dict) or set(row) != {"timestamp", "reason"}:
                            raise ValidationError("invalid_failure_row")
                        stamp = row["timestamp"]
                        if (type(stamp) not in (int, float) or not math.isfinite(stamp)
                                or not 0 <= stamp <= now or stamp < previous
                                or row["reason"] not in ("source_unavailable", "invalid_sample")):
                            raise ValidationError("invalid_failure_row")
                        previous = stamp
                self._histories, self._failures = histories, copy.deepcopy(failures)
            elif payload is not None:
                raise ValidationError("unexpected_store_payload")
            for binding in self.bindings:
                source = binding["source_uuid"]
                self._histories.setdefault(source, History(source))
                self._failures.setdefault(source, [])
                self._errors[source] = "awaiting_sample"
            if len(self._histories) > MAX_STORED_SOURCES:
                raise ValidationError("stored_source_limit")
            self._active = True
        except (ValidationError, TypeError, ValueError, OverflowError) as err:
            self._storage_error = True
            raise RuntimeUnavailable("storage_error") from err

    def _split(self, source, reason, current=None, errors=None):
        self._segments[source] = uuid4().hex
        self._identities.pop(source, None)
        (self._current if current is None else current).pop(source, None)
        (self._errors if errors is None else errors)[source] = reason

    async def refresh(self):
        """One scheduled sample per source per interval; serialized with stop/save."""
        self._require_active()
        async with self._lock:
            self._require_active()
            # Copy already validated memory without treating a live clock
            # rollback as corruption of the acknowledged file.
            histories = {source: History(source, history.samples, capped=history.capped)
                         for source, history in self._histories.items()}
            failures = copy.deepcopy(self._failures)
            current, errors = copy.deepcopy(self._current), dict(self._errors)
            changed = False
            for binding in self.bindings:
                if not self._active:
                    return
                source = binding["source_uuid"]
                now = self._clock()
                last_attempt = self._attempts.get(source)
                if last_attempt is not None:
                    if now < last_attempt:
                        self._split(source, "future_clock", current, errors)
                        continue
                    if now-last_attempt < SAMPLE_SECONDS:
                        continue
                self._attempts[source] = now
                try:
                    raw = await self._sampler(copy.deepcopy(binding))
                    if not self._active:
                        return
                except asyncio.CancelledError:
                    self._split(source, "source_unavailable")
                    raise
                except Exception:
                    if not self._active:
                        return
                    self._split(source, "source_unavailable", current, errors)
                    failures[source] = (failures.get(source, []) + [
                        {"timestamp": now, "reason": "source_unavailable"}])[-MAX_FAILURES:]
                    changed = True
                    continue
                try:
                    identity = raw["identity"]
                    if not isinstance(identity, str) or not identity or len(identity) > 512:
                        raise ValidationError("invalid_identity")
                    if self._identities.get(source, identity) != identity:
                        self._split(source, "source_identity_changed", current, errors)
                    sample = Sample(
                        source, binding["binding_revision"], self._segments[source], uuid4().hex,
                        raw["timestamp"], raw["used_bytes"], raw["total_bytes"],
                        raw["free_bytes"], raw["reserved_bytes"], "strong")
                    histories[source].append(sample, now=self._clock())
                    self._identities[source] = identity
                    current[source] = {
                        "used_bytes": sample.used_bytes, "total_bytes": sample.total_bytes,
                        "free_bytes": sample.free_bytes, "reserved_bytes": sample.reserved_bytes,
                        "measured_at": sample.measured_at,
                        "free_semantics": "available_to_process", "free_computed": False,
                    }
                    errors.pop(source, None)
                except (ValidationError, KeyError, TypeError, ValueError, OverflowError):
                    self._split(source, "invalid_sample", current, errors)
                    failures[source] = (failures.get(source, []) + [
                        {"timestamp": now, "reason": "invalid_sample"}])[-MAX_FAILURES:]
                changed = True
            if not self._active:
                return
            if not changed:
                self._current, self._errors = current, errors
                return
            payload = {"version": 1, "history": dump_store(histories), "failures": failures}
            try:
                await self._save(payload)
            except BaseException:
                # Cancellation after an uncertain save cannot cause an automatic
                # retry or a final flush. Preserve the file for readback on reload.
                self._storage_error = True
                self._current.clear()
                raise RuntimeUnavailable("storage_error")
            self._histories, self._failures = histories, failures
            self._current, self._errors = current, errors

    def status(self):
        """Fresh DTO from acknowledged state. Caller applies current admin ACL."""
        self._require_active()
        now = self._clock()
        sources = []
        for binding in self.bindings:
            source = binding["source_uuid"]
            result = forecast(self._histories[source].samples, now=now)
            current = self._current.get(source)
            reason = self._errors.get(source)
            if current and now-current["measured_at"] > 3600:
                reason = "stale"
            if current and now < current["measured_at"]:
                reason = "future_clock"
            if reason:
                current = None
                result.update(full_in_days=None, quality="unknown", reason=reason)
            sources.append({"source": {
                "kind": "local_fs_samples", "source_uuid": source,
                "binding_revision": binding["binding_revision"],
                "label": binding.get("label", binding["mountpoint"]),
                "scope": "ha_process_filesystem",
                "identity_quality": "process_mount_namespace",
            }, "current": current, "forecast": result, "error": reason})
        return copy.deepcopy({"schema_version": 1, "read_at": now, "sources": sources,
                              "permissions": {"admin_only": True}})

    def history(self, source_uuid, binding_revision, days):
        self._require_active()
        if not any(b["source_uuid"] == source_uuid and b["binding_revision"] == binding_revision for b in self.bindings):
            raise RuntimeUnavailable("source_binding_changed")
        return history_window(self._histories[source_uuid], now=self._clock(), days=days)

    async def stop(self):
        """Invalidate before waiting, then finish any already sent save. No flush."""
        self._active = False
        async with self._lock:
            self._current.clear()
