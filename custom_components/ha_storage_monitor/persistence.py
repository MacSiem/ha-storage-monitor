"""Strict Store adapter with disk readback; never asks HA to repair corruption.

HA Store.async_save can log a WriteError without raising. async_load may rename a
corrupt file and return None. We therefore load strictly ourselves and verify the
physical envelope after each supported HA write. All disk I/O uses the executor.
This detects pre-existing conflicts, not an atomic CAS against external editors.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
from pathlib import Path
import stat

MAX_BYTES = 64 * 1024 * 1024


class PersistenceError(Exception):
    """A sanitized failure; preserve disk and prohibit this runtime's later saves."""


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError("duplicate_key")
        result[key] = value
    return result


def _constant(value):
    raise ValueError("nonfinite_number")


def _snapshot(path: Path, key: str):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        return None, None
    try:
        with os.fdopen(fd, "rb") as handle:
            before = os.fstat(handle.fileno())
            if not stat.S_ISREG(before.st_mode) or before.st_size > MAX_BYTES:
                raise ValueError("invalid_store_file")
            raw = handle.read(MAX_BYTES+1)
            after = os.fstat(handle.fileno())
            if (len(raw) > MAX_BYTES or before.st_size != after.st_size
                    or before.st_mtime_ns != after.st_mtime_ns):
                raise ValueError("store_changed_during_read")
        parsed = json.loads(raw, object_pairs_hook=_pairs, parse_constant=_constant)
        if (not isinstance(parsed, dict)
                or set(parsed) != {"version", "minor_version", "key", "data"}
                or type(parsed["version"]) is not int or parsed["version"] != 1
                or type(parsed["minor_version"]) is not int or parsed["minor_version"] != 1
                or parsed["key"] != key or not isinstance(parsed["data"], dict)):
            raise ValueError("invalid_store_envelope")
        identity = (after.st_dev, after.st_ino, hashlib.sha256(raw).hexdigest())
        return parsed["data"], identity
    except (OSError, ValueError, UnicodeError, TypeError, RecursionError) as err:
        raise PersistenceError("stored_file_rejected") from err


class VerifiedStore:
    """Own one fixed integration Store path and serialize acknowledged writes."""

    def __init__(self, path, key, writer, executor):
        self._path, self._key = Path(path), key
        self._writer, self._executor = writer, executor
        self._identity = None
        self._loaded = self._failed = False
        self._lock = asyncio.Lock()

    async def load(self):
        if self._loaded or self._failed:
            raise PersistenceError("store_already_initialized")
        try:
            payload, self._identity = await self._executor(_snapshot, self._path, self._key)
            self._loaded = True
            return payload, self._identity is not None
        except Exception as err:
            self._failed = True
            raise PersistenceError("stored_file_rejected") from err

    async def save(self, payload):
        if not self._loaded or self._failed:
            raise PersistenceError("store_unavailable")
        async with self._lock:
            if self._failed:
                raise PersistenceError("store_unavailable")
            try:
                # Validate serialization before invoking HA and capture an
                # immutable payload; do not hold a mutable caller object.
                raw = json.dumps(payload, allow_nan=False)
                if len(raw.encode()) > MAX_BYTES-1024:
                    raise ValueError("store_limit")
                expected = json.loads(raw)
                _, observed = await self._executor(_snapshot, self._path, self._key)
                if observed != self._identity:
                    raise PersistenceError("store_external_change")

                async def write_and_readback():
                    await self._writer(expected)
                    actual, identity = await self._executor(_snapshot, self._path, self._key)
                    if actual != expected or identity is None:
                        raise PersistenceError("store_write_not_confirmed")
                    self._identity = identity

                task = asyncio.create_task(write_and_readback())
                try:
                    await asyncio.shield(task)
                except asyncio.CancelledError:
                    # Finish/read back the already sent write before releasing
                    # the owner. Never detach a disk mutation into the background.
                    try:
                        await task
                    finally:
                        raise
            except BaseException:
                self._failed = True
                raise
