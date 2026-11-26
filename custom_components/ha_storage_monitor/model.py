"""Pure, deterministic Storage sample/history/forecast model (stdlib only).

All timestamps are finite Unix UTC seconds, sizes bytes. No I/O or HA dependency.
The caller must supply a NEW segment_id after every process restart, remount,
clock rollback, unavailable mount or binding change. A segment is observational;
no interval of physical filesystem continuity is inferred from two samples.

Persistence contract: load_store raises StoreError on ANY corrupt record; it never
returns a replacement empty store. The coordinator must latch a storage error and
block saves until a separate explicit repair/migration has resolved that error.
"""
from dataclasses import asdict, dataclass
import math
from collections.abc import Mapping

DAY = 86400
SCHEDULE_SECONDS = 1800
RETENTION_SECONDS = 30 * DAY
FORECAST_SECONDS = 7 * DAY
MAX_RECORDS = 4096
SCHEMA_VERSION = 1


class ValidationError(ValueError):
    """Invalid sample, order, source or caller input; no mutation performed."""


class StoreError(ValidationError):
    """Stored data is unusable. Caller MUST NOT save an empty replacement."""


def _number(value, name):
    if type(value) not in (int, float):
        raise ValidationError(f"{name}: expected finite non-boolean number")
    try:
        valid = math.isfinite(value)
    except (OverflowError, TypeError):
        valid = False
    if not valid or value < 0:
        raise ValidationError(f"{name}: expected finite nonnegative number")
    return value


def _text(value, name):
    if not isinstance(value, str) or not value.strip() or len(value) > 512:
        raise ValidationError(f"{name}: expected nonempty string of <=512 characters")
    return value


def _same_size(left, right):
    # At 1 TB this allows at most one byte; at small sizes one microbyte.
    return math.isclose(left, right, rel_tol=1e-12, abs_tol=1e-6)


@dataclass(frozen=True)
class Sample:
    """One atomic validated filesystem tuple; free_bytes is actual available free.

    reserved_bytes must agree with total-used-free within float tolerance. It is
    stored explicitly; total-used is never substituted for free_bytes.
    identity_quality='limited' allows history, but always disables forecasting.
    """
    source_uuid: str
    binding_revision: str
    segment_id: str
    sample_id: str
    measured_at: float
    used_bytes: float
    total_bytes: float
    free_bytes: float
    reserved_bytes: float
    identity_quality: str = "strong"

    def __post_init__(self):
        for name in ("source_uuid", "binding_revision", "segment_id", "sample_id"):
            _text(getattr(self, name), name)
        for name in ("measured_at", "used_bytes", "total_bytes", "free_bytes", "reserved_bytes"):
            _number(getattr(self, name), name)
        if self.total_bytes <= 0:
            raise ValidationError("total_bytes: must be positive")
        try:
            combined = self.used_bytes + self.free_bytes
            finite_sum = math.isfinite(combined)
        except OverflowError:
            finite_sum = False
        if not finite_sum:
            raise ValidationError("size sum overflow")
        if combined > self.total_bytes and not _same_size(combined, self.total_bytes):
            raise ValidationError("used + available free exceeds total")
        try:
            accounted = combined + self.reserved_bytes
            balanced = math.isfinite(accounted) and _same_size(accounted, self.total_bytes)
        except OverflowError:
            balanced = False
        if not balanced:
            raise ValidationError("reserved does not match total-used-free")
        if self.identity_quality not in ("strong", "limited"):
            raise ValidationError("identity_quality: unsupported value")

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, data):
        if not isinstance(data, Mapping) or set(data) != set(cls.__dataclass_fields__):
            raise ValidationError("sample schema mismatch")
        try:
            return cls(**data)
        except (TypeError, OverflowError) as error:
            raise ValidationError("invalid sample") from error


def _ordered(samples, source=None, *, allow_duplicates=False):
    """Validate input order as supplied; never sort away a clock rollback."""
    if not isinstance(samples, (list, tuple)):
        raise ValidationError("samples must be list or tuple")
    output, identifiers = [], {}
    for sample in samples:
        if not isinstance(sample, Sample):
            raise ValidationError("invalid_samples")
        if source is None:
            source = sample.source_uuid
        if sample.source_uuid != source:
            raise ValidationError("mixed_sources")
        previous = identifiers.get(sample.sample_id)
        if previous is not None:
            if allow_duplicates and previous == sample:
                continue
            raise ValidationError("duplicate_sample")
        if output and sample.measured_at <= output[-1].measured_at:
            raise ValidationError("out_of_order")
        output.append(sample)
        identifiers[sample.sample_id] = sample
    return output


def _segment_key(sample):
    # Exact sizes intentionally split on every observed capacity/reservation change.
    # Numeric tuple validation has float tolerance; continuity is conservative.
    return (sample.source_uuid, sample.binding_revision, sample.segment_id,
            sample.identity_quality, sample.total_bytes, sample.reserved_bytes)


class History:
    """Single-source history, capped at 30 days / 4096 rows after each append.

    samples is an immutable tuple snapshot. append is transactional: invalid,
    conflicting, future or out-of-order input raises and preserves existing rows.
    Identical duplicate sample_id+payload is a no-op. Distinct IDs at the same
    timestamp are rejected, not counted as two scheduled successes.
    """
    def __init__(self, source_uuid, samples=(), *, capped=False):
        self.source_uuid = _text(source_uuid, "source_uuid")
        if type(capped) is not bool:
            raise ValidationError("capped must be boolean")
        ordered = _ordered(samples, source_uuid)
        if len(ordered) > MAX_RECORDS:
            raise ValidationError("history exceeds hard limit")
        if ordered and ordered[-1].measured_at-ordered[0].measured_at > RETENTION_SECONDS:
            raise ValidationError("history exceeds retention")
        self._samples = tuple(ordered)
        self.capped = capped

    @property
    def samples(self):
        return self._samples

    def append(self, sample, *, now):
        _number(now, "now")
        if not isinstance(sample, Sample) or sample.source_uuid != self.source_uuid:
            raise ValidationError("invalid sample source")
        if sample.measured_at > now:
            raise ValidationError("future_clock")
        if sample.measured_at < now-RETENTION_SECONDS:
            raise ValidationError("expired_sample")
        for old in self._samples:
            if old.sample_id == sample.sample_id:
                if old == sample:
                    return False
                raise ValidationError("conflicting_duplicate")
        if self._samples and sample.measured_at <= self._samples[-1].measured_at:
            raise ValidationError("out_of_order")
        cutoff = now-RETENTION_SECONDS
        rows = [p for p in self._samples if p.measured_at >= cutoff]
        rows.append(sample)
        if len(rows) > MAX_RECORDS:
            rows = rows[-MAX_RECORDS:]
            self.capped = True
        self._samples = tuple(rows)
        return True


def _coverage(samples):
    """Count occupied 30-min slots anchored at first observation, never raw rows.

    Slots are half-open [first+k*1800, first+(k+1)*1800), including the final
    occupied slot. This describes scheduled observation coverage, NOT filesystem
    continuity. Several successes in one slot count once. No backfill occurs.
    """
    if not samples:
        return {"successful_slots": 0, "expected_slots": 0, "ratio": None,
                "longest_gap_seconds": None, "schedule_seconds": SCHEDULE_SECONDS}
    start = samples[0].measured_at
    occupied = {int((p.measured_at-start)//SCHEDULE_SECONDS) for p in samples}
    expected = int((samples[-1].measured_at-start)//SCHEDULE_SECONDS)+1
    longest = max((b.measured_at-a.measured_at for a, b in zip(samples, samples[1:])), default=0)
    return {"successful_slots": len(occupied), "expected_slots": expected,
            "ratio": len(occupied)/expected, "longest_gap_seconds": longest,
            "schedule_seconds": SCHEDULE_SECONDS}


def forecast(samples, *, now):
    """Return DTO; unknown is None plus machine-readable reason, never a fake 0.

    OLS used bytes against true elapsed days within latest stable segment, <=7d
    ending at calculation time. Gates: >=3 samples, >=24h observed, >=80% slots,
    no gap >90min, latest <=60min, strong identity, slope AND net growth >0.
    Positive results are unrounded. Actual free=0 yields zero only after all gates.
    """
    _number(now, "now")
    result = {"full_in_days": None, "growth_bytes_per_day": None,
              "method": "ols_used_bytes_actual_elapsed_days", "sample_count": 0,
              "quality": "unknown", "reason": None, "calculated_at": now,
              "measured_at": None, "source_uuid": None, "segment_id": None,
              "window": {"maximum_seconds": FORECAST_SECONDS, "start": None,
                         "end": None, "observed_seconds": 0},
              "coverage": _coverage([]), "confirmed_intervals": [],
              "physical_continuity": "unknown"}

    def unknown(reason):
        result["reason"] = reason
        return result

    try:
        rows = _ordered(samples, allow_duplicates=True)
    except ValidationError as error:
        return unknown(str(error))
    if not rows:
        return unknown("no_samples")
    latest = rows[-1]
    result.update(measured_at=latest.measured_at, source_uuid=latest.source_uuid,
                  segment_id=latest.segment_id)
    if latest.measured_at > now:
        return unknown("future_clock")
    key = _segment_key(latest)
    stable = []
    for row in reversed(rows):
        if _segment_key(row) != key or row.measured_at < now-FORECAST_SECONDS:
            break
        stable.append(row)
    stable.reverse()
    result["sample_count"] = len(stable)
    result["coverage"] = _coverage(stable)
    if stable:
        result["window"].update(start=stable[0].measured_at, end=stable[-1].measured_at,
                                observed_seconds=stable[-1].measured_at-stable[0].measured_at)
    if latest.identity_quality != "strong":
        return unknown("identity_limited")
    if now-latest.measured_at > 3600:
        return unknown("stale")
    if len(stable) < 3:
        return unknown("insufficient_samples")
    if result["window"]["observed_seconds"] < DAY:
        return unknown("insufficient_span")
    coverage = result["coverage"]
    if coverage["ratio"] < 0.8:
        return unknown("low_coverage")
    if coverage["longest_gap_seconds"] > 5400:
        return unknown("gap_too_long")
    x = [(p.measured_at-stable[0].measured_at)/DAY for p in stable]
    # Center against the first measured size before averaging to preserve low
    # growth on large filesystems; fsum limits cancellation in covariance.
    y = [p.used_bytes-stable[0].used_bytes for p in stable]
    try:
        mean_x, mean_y = math.fsum(x)/len(x), math.fsum(y)/len(y)
        denominator = math.fsum((value-mean_x)**2 for value in x)
        slope = math.fsum((a-mean_x)*(b-mean_y) for a, b in zip(x, y))/denominator
    except (OverflowError, ZeroDivisionError, ValueError):
        return unknown("numeric_range")
    if not math.isfinite(slope):
        return unknown("numeric_range")
    result["growth_bytes_per_day"] = slope
    if slope <= 0 or stable[-1].used_bytes <= stable[0].used_bytes:
        return unknown("nonpositive_growth")
    days = latest.free_bytes/slope
    if not math.isfinite(days) or (latest.free_bytes > 0 and days == 0):
        return unknown("numeric_range")
    result.update(full_in_days=days, quality="limited_estimate")
    return result


def history_window(history, *, now, days):
    """Return measured points and explicit observation gaps; no held/backfilled rows.

    Window is inclusive, anchored at now. Segments are grouped by effective key,
    so an accidentally reused caller ID cannot join capacity/reservation changes.
    Pagination and ACL belong to the coordinator/WS layer, not this pure model.
    """
    _number(now, "now")
    if type(days) is not int or days not in (7, 30):
        raise ValidationError("days must be 7 or 30")
    if not isinstance(history, History):
        raise ValidationError("history must be History")
    if history.samples and history.samples[-1].measured_at > now:
        raise ValidationError("future_clock")
    rows = [p for p in history.samples if now-days*DAY <= p.measured_at <= now]
    segments = []
    for row in rows:
        if not segments or segments[-1][0] != _segment_key(row):
            segments.append((_segment_key(row), []))
        segments[-1][1].append(row)
    return {"source_uuid": history.source_uuid,
            "requested_window": {"start": now-days*DAY, "end": now, "seconds": days*DAY},
            "observed_window": {"start": rows[0].measured_at if rows else None,
                                "end": rows[-1].measured_at if rows else None,
                                "seconds": rows[-1].measured_at-rows[0].measured_at if rows else 0},
            "rows": [p.to_dict() for p in rows], "coverage": _coverage(rows),
            "segments": [{"segment_id": group[0].segment_id,
                          "binding_revision": group[0].binding_revision,
                          "start": group[0].measured_at, "end": group[-1].measured_at,
                          "sample_count": len(group)} for _, group in segments],
            "gaps": [{"start": a.measured_at, "end": b.measured_at,
                      "seconds": b.measured_at-a.measured_at}
                     for a, b in zip(rows, rows[1:])
                     if b.measured_at-a.measured_at > SCHEDULE_SECONDS],
            "last_success": history.samples[-1].measured_at if history.samples else None,
            "capped": history.capped, "confirmed_intervals": [],
            "physical_continuity": "unknown"}


def dump_store(histories):
    """Build JSON-compatible payload only. Caller serializes/saves atomically."""
    if not isinstance(histories, Mapping):
        raise ValidationError("histories must be mapping")
    output = {}
    for source, history in histories.items():
        if not isinstance(history, History) or source != history.source_uuid:
            raise ValidationError("history source mismatch")
        output[source] = {"capped": history.capped,
                          "samples": [p.to_dict() for p in history.samples]}
    return {"version": SCHEMA_VERSION, "sources": output}


def load_store(payload, *, now):
    """Validate ALL persisted input before returning anything; never mutate payload.

    Missing file must be handled explicitly by the caller as first installation.
    None, wrong version, duplicates, invalid size, future dates and unsorted rows
    are errors. Old valid records are pruned only after complete validation, so a
    corrupt old row is not hidden by retention. No partial recovery is attempted.
    """
    try:
        _number(now, "now")
        if not isinstance(payload, Mapping) or set(payload) != {"version", "sources"}:
            raise ValidationError("store schema mismatch")
        if type(payload["version"]) is not int or payload["version"] != SCHEMA_VERSION:
            raise ValidationError("unsupported store version")
        if not isinstance(payload["sources"], Mapping):
            raise ValidationError("sources must be mapping")
        loaded = {}
        for source, data in payload["sources"].items():
            _text(source, "source_uuid")
            if not isinstance(data, Mapping) or set(data) != {"samples", "capped"}:
                raise ValidationError("source schema mismatch")
            if type(data["capped"]) is not bool or not isinstance(data["samples"], list):
                raise ValidationError("invalid source schema")
            if len(data["samples"]) > MAX_RECORDS:
                raise ValidationError("stored source exceeds hard cap")
            rows = _ordered([Sample.from_dict(row) for row in data["samples"]], source)
            if rows and rows[-1].measured_at > now:
                raise ValidationError("future_clock")
            if rows and rows[-1].measured_at-rows[0].measured_at > RETENTION_SECONDS:
                raise ValidationError("stored source exceeds retention")
            retained = [row for row in rows if row.measured_at >= now-RETENTION_SECONDS]
            loaded[source] = History(source, retained, capped=data["capped"])
        return loaded
    except (ValidationError, TypeError, KeyError, OverflowError) as error:
        raise StoreError(f"stored history rejected: {error}") from error
