"""Regression sources; run with stdlib unittest after owner FIFO admission."""
import copy
import unittest

import importlib.util
from pathlib import Path
import sys

_model_path = Path(__file__).resolve().parents[1] / "custom_components/ha_storage_monitor/model.py"
_spec = importlib.util.spec_from_file_location("storage_forecast_model", _model_path)
_module = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = _module
_spec.loader.exec_module(_module)

from storage_forecast_model import (History, Sample, StoreError, ValidationError, forecast,
                   history_window, load_store, dump_store, DAY, MAX_RECORDS)

BASE = 1_780_000_000.0


def point(i, *, segment="boot-a", total=10_000_000.0, reserved=200_000.0,
          used=None, source="disk-a", revision="1", identity="strong"):
    used = 1_000_000.0 + i * 1000 if used is None else used
    return Sample(source, revision, segment, f"{segment}-{i}", BASE + i * 1800,
                  used, total, total - used - reserved, reserved, identity)


def regular(count=49, **kwargs):
    return [point(i, **kwargs) for i in range(count)]


class ValidationTests(unittest.TestCase):
    def test_reject_nonfinite_boolean_negative_and_bad_tuple(self):
        data = point(0).to_dict()
        for key in ("measured_at", "used_bytes", "total_bytes", "free_bytes", "reserved_bytes"):
            for value in (True, float("nan"), float("inf"), -1):
                with self.subTest(key=key, value=value):
                    bad = dict(data, **{key: value})
                    with self.assertRaises(ValidationError):
                        Sample.from_dict(bad)
        for patch in ({"total_bytes": 0}, {"used_bytes": 10_000_001},
                      {"free_bytes": 9_000_001}, {"reserved_bytes": 1},
                      {"source_uuid": ""}, {"segment_id": ""},
                      {"identity_quality": "physical_confirmed"}):
            with self.subTest(patch=patch), self.assertRaises(ValidationError):
                Sample.from_dict(dict(data, **patch))

    def test_small_float_tolerance_and_actual_reserved(self):
        self.assertEqual(Sample("s", "1", "b", "x", BASE, 0.3, 1, 0.6,
                                0.1).reserved_bytes, 0.1)
        with self.assertRaises(ValidationError):
            Sample("s", "1", "b", "x", BASE, 0.3, 1, 0.6, 0.10001)

    def test_unknown_fields_not_silently_dropped(self):
        with self.assertRaises(ValidationError):
            Sample.from_dict(dict(point(0).to_dict(), invented=True))


class ForecastTests(unittest.TestCase):
    def test_actual_free_and_ols_real_times(self):
        samples = regular()
        result = forecast(samples, now=samples[-1].measured_at)
        self.assertEqual(result["quality"], "limited_estimate")
        self.assertIsNone(result["reason"])
        self.assertAlmostEqual(result["growth_bytes_per_day"], 48000)
        self.assertAlmostEqual(result["full_in_days"], samples[-1].free_bytes / 48000)
        self.assertNotEqual(result["full_in_days"],
                            (samples[-1].total_bytes-samples[-1].used_bytes)/48000)
        self.assertEqual(result["coverage"]["successful_slots"], 49)
        self.assertEqual(result["coverage"]["expected_slots"], 49)
        self.assertNotIn("confidence", result)
        self.assertEqual(result["confirmed_intervals"], [])
        self.assertEqual(result["physical_continuity"], "unknown")

    def test_sparse_two_or_three_points_cannot_predict(self):
        for samples, reason in (([point(0), point(48)], "insufficient_samples"),
                                ([point(0), point(24), point(48)], "low_coverage"),
                                (regular(3), "insufficient_span")):
            with self.subTest(reason=reason):
                result = forecast(samples, now=samples[-1].measured_at)
                self.assertEqual(result["reason"], reason)
                self.assertIsNone(result["full_in_days"])

    def test_coverage_counts_slots_not_fast_samples(self):
        samples = [point(0)]
        for i in range(1, 99):
            original = point(i)
            samples.append(Sample.from_dict(dict(original.to_dict(),
                                                 measured_at=BASE+i, sample_id=f"fast-{i}")))
        samples.append(point(48))
        result = forecast(samples, now=BASE+DAY)
        self.assertEqual(result["coverage"]["successful_slots"], 2)
        self.assertEqual(result["reason"], "low_coverage")

    def test_coverage_and_gap_thresholds(self):
        samples = [p for i, p in enumerate(regular()) if i not in (10, 11)]
        self.assertIsNone(forecast(samples, now=BASE+DAY)["reason"])
        samples = [p for i, p in enumerate(regular()) if i not in (10, 11, 12)]
        self.assertEqual(forecast(samples, now=BASE+DAY)["reason"], "gap_too_long")
        samples = [p for i, p in enumerate(regular()) if i % 4 != 1]
        self.assertEqual(forecast(samples, now=BASE+DAY)["reason"], "low_coverage")

    def test_exact_eighty_percent_is_eligible(self):
        samples = [p for i, p in enumerate(regular(50)) if i % 5 != 1]
        result = forecast(samples, now=BASE+49*1800)
        self.assertEqual(result["coverage"]["ratio"], 0.8)
        self.assertIsNone(result["reason"])
        result = forecast(samples[:10]+samples[11:], now=BASE+49*1800)
        self.assertEqual(result["reason"], "low_coverage")

    def test_stale_and_future_clock(self):
        self.assertIsNone(forecast(regular(), now=BASE+DAY+3600)["reason"])
        self.assertEqual(forecast(regular(), now=BASE+DAY+3600.01)["reason"], "stale")
        self.assertEqual(forecast(regular(), now=BASE+DAY-0.01)["reason"], "future_clock")

    def test_growth_zero_negative_or_net_nonpositive_is_unknown(self):
        for samples in (regular(used=2_000_000),
                        [point(i, used=2_000_000-i*1000) for i in range(49)]):
            self.assertEqual(forecast(samples, now=BASE+DAY)["reason"], "nonpositive_growth")
        samples = [point(i, used=1_000_000+i*1000) for i in range(49)]
        samples[-1] = point(48, used=999_000)
        self.assertGreater(forecast(samples, now=BASE+DAY)["growth_bytes_per_day"], 0)
        self.assertEqual(forecast(samples, now=BASE+DAY)["reason"], "nonpositive_growth")

    def test_actual_zero_only_with_valid_growth_and_no_rounding(self):
        samples = [point(i, used=9_752_000+i*1000) for i in range(49)]
        self.assertEqual(forecast(samples, now=BASE+DAY)["full_in_days"], 0)
        samples[-1] = point(48, used=9_799_999.999)
        self.assertGreater(forecast(samples, now=BASE+DAY)["full_in_days"], 0)
        samples = regular(used=9_800_000)
        self.assertIsNone(forecast(samples, now=BASE+DAY)["full_in_days"])

    def test_segment_capacity_reservation_revision_and_identity_boundaries(self):
        for replacement in (point(48, segment="boot-b"),
                            point(48, total=11_000_000),
                            point(48, reserved=100_000),
                            point(48, revision="2")):
            samples = regular()[:-1] + [replacement]
            result = forecast(samples, now=BASE+DAY)
            self.assertEqual(result["sample_count"], 1)
            self.assertEqual(result["reason"], "insufficient_samples")
        samples = regular(identity="limited")
        self.assertEqual(forecast(samples, now=BASE+DAY)["reason"], "identity_limited")

    def test_seven_day_window_and_restart_history(self):
        samples = regular(400)
        result = forecast(samples, now=samples[-1].measured_at)
        self.assertEqual(result["sample_count"], 337)
        self.assertEqual(result["window"]["observed_seconds"], 7*DAY)
        history = History("disk-a", samples)
        history.append(point(400, segment="boot-b"), now=BASE+400*1800)
        self.assertEqual(forecast(history.samples, now=BASE+400*1800)["sample_count"], 1)
        self.assertEqual(len(history.samples), 401)

    def test_nonuniform_real_elapsed_ols_and_duplicates(self):
        samples = []
        for i in range(49):
            stamp = BASE+i*1800+(20 if i % 2 else 0)
            used = 1_000_000+(stamp-BASE)*2
            samples.append(Sample("disk-a", "1", "boot-a", str(i), stamp,
                                  used, 10_000_000, 9_800_000-used, 200_000))
        result = forecast(samples, now=BASE+DAY)
        self.assertAlmostEqual(result["growth_bytes_per_day"], 2*DAY)
        self.assertEqual(forecast(samples + [samples[-1]], now=BASE+DAY)["sample_count"],49)
        self.assertEqual(forecast(list(reversed(samples)), now=BASE+DAY)["reason"], "out_of_order")
        self.assertEqual(forecast([point(0), point(1, source="disk-b")],
                                  now=BASE+DAY)["reason"], "mixed_sources")


class HistoryPersistenceTests(unittest.TestCase):
    def test_append_duplicate_conflict_order_future_and_atomicity(self):
        history = History("disk-a")
        self.assertTrue(history.append(point(1), now=BASE+1800))
        self.assertFalse(history.append(point(1), now=BASE+1800))
        for sample in (point(0), point(2), point(1, used=2_000_000),
                       point(3, source="other")):
            with self.subTest(sample=sample), self.assertRaises(ValidationError):
                history.append(sample, now=BASE+1800)
            self.assertEqual(history.samples, (point(1),))

    def test_retention_and_hard_cap(self):
        history = History("disk-a")
        for i in range(MAX_RECORDS+1):
            sample = Sample("disk-a", "1", "b", str(i), BASE+i,
                            i, 10_000_000, 9_800_000-i, 200_000)
            history.append(sample, now=sample.measured_at)
        self.assertEqual(len(history.samples), MAX_RECORDS)
        self.assertTrue(history.capped)
        history.append(point(2000), now=BASE+2000*1800)
        self.assertEqual(history.samples, (point(2000),))

    def test_stale_append_is_rejected_without_retaining_expired_row(self):
        history = History("disk-a")
        with self.assertRaises(ValidationError):
            history.append(point(0), now=BASE+31*DAY)
        self.assertEqual(history.samples, ())

    def test_requested_window_is_not_observed_and_no_fabricated_intervals(self):
        history = History("disk-a", regular(3))
        result = history_window(history, now=BASE+3600, days=30)
        self.assertEqual(result["requested_window"]["seconds"], 30*DAY)
        self.assertEqual(result["observed_window"]["seconds"], 3600)
        self.assertEqual(len(result["rows"]), 3)
        self.assertEqual(result["confirmed_intervals"], [])
        self.assertEqual(result["physical_continuity"], "unknown")
        with self.assertRaises(ValidationError):
            history_window(history, now=BASE+3600, days=True)

    def test_load_rejects_corrupt_expired_data_before_pruning(self):
        payload = dump_store({"disk-a": History("disk-a", regular())})
        payload["sources"]["disk-a"]["samples"][0]["used_bytes"] = "corrupt"
        with self.assertRaises(StoreError):
            load_store(payload, now=BASE+50*DAY)

    def test_retention_load_prunes_valid_old_data_and_missing_is_error(self):
        payload = dump_store({"disk-a": History("disk-a", regular())})
        self.assertEqual(load_store(payload, now=BASE+50*DAY)["disk-a"].samples, ())
        with self.assertRaises(StoreError):
            load_store(None, now=BASE+DAY)
        payload["version"] = True
        with self.assertRaises(StoreError):
            load_store(payload, now=BASE+DAY)

    def test_roundtrip_and_reject_corruption_without_mutating_input(self):
        history = History("disk-a", regular())
        payload = dump_store({"disk-a": history})
        self.assertEqual(load_store(payload, now=BASE+DAY)["disk-a"].samples, history.samples)
        for mutate in (lambda p: p.update(version=999),
                       lambda p: p["sources"]["disk-a"]["samples"][0].update(used_bytes=True),
                       lambda p: p["sources"]["disk-a"]["samples"].reverse(),
                       lambda p: p["sources"]["disk-a"].update(capped="false"),
                       lambda p: p["sources"]["disk-a"]["samples"].append(
                           p["sources"]["disk-a"]["samples"][0]),
                       lambda p: p.update(extra="not silently ignored")):
            corrupted = copy.deepcopy(payload)
            mutate(corrupted)
            before = copy.deepcopy(corrupted)
            with self.subTest(payload=corrupted), self.assertRaises(StoreError):
                load_store(corrupted, now=BASE+DAY)
            self.assertEqual(corrupted, before)
        with self.assertRaises(StoreError):
            load_store(payload, now=BASE)


if __name__ == "__main__":
    unittest.main()
