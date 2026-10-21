"""Persistence and lifecycle regressions for the actual backend engine, no HA stubs."""
import asyncio
import copy
import importlib
from pathlib import Path
import sys
import types
import unittest

PKG = "storage_runtime_test"
package = types.ModuleType(PKG)
package.__path__ = [str(Path(__file__).resolve().parents[1] / "custom_components/ha_storage_monitor")]
package.__spec__ = importlib.machinery.ModuleSpec(PKG, loader=None, is_package=True)
package.__spec__.submodule_search_locations = package.__path__
sys.modules[PKG] = package

BASE = 1780000000.0
BINDING = {"source_uuid": "disk-a", "binding_revision": "1", "mountpoint": "/config"}


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.m = importlib.import_module(f"{PKG}.runtime")
        self.saved, self.now = [], BASE
        self.calls = 0
        self.used, self.identity = 600, "mount-a"
        self.error = None

    async def sampler(self, binding):
        self.calls += 1
        if self.error:
            raise self.error
        return {"timestamp": self.now, "identity": self.identity,
                "used_bytes": self.used, "total_bytes": 1000,
                "free_bytes": 950-self.used, "reserved_bytes": 50,
                "scope": "ha_process_filesystem", "free_semantics": "available_to_process"}

    async def save(self, payload):
        self.saved.append(copy.deepcopy(payload))

    def engine(self, save=None):
        return self.m.StorageRuntime([BINDING], self.sampler, save or self.save,
                                     clock=lambda: self.now)

    async def test_first_install_persists_actual_sample_and_unknown_forecast(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        await e.refresh()
        status = e.status()["sources"][0]
        self.assertEqual(status["current"]["free_bytes"], 350)
        self.assertIsNone(status["forecast"]["full_in_days"])
        self.assertEqual(status["forecast"]["reason"], "insufficient_samples")
        self.assertEqual(len(self.saved), 1)
        self.assertEqual(len(e.history("disk-a", "1", 30)["rows"]), 1)

    async def test_existing_null_or_corrupt_store_is_never_overwritten_even_unload(self):
        for payload in (None, {}, {"version": 999}, {"version": 1, "history": None, "failures": {}}):
            with self.subTest(payload=payload):
                e = self.engine()
                with self.assertRaises(self.m.RuntimeUnavailable):
                    await e.start(payload, file_exists=True)
                with self.assertRaises(self.m.RuntimeUnavailable):
                    await e.refresh()
                await e.stop()
                self.assertEqual(self.saved, [])
                self.assertEqual(self.calls, 0)

    async def test_read_apis_never_sample_or_save(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        e.status()
        e.history("disk-a", "1", 7)
        self.assertEqual((self.calls, len(self.saved)), (0, 0))

    async def test_repeated_refresh_same_slot_does_not_create_samples(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        await asyncio.gather(e.refresh(), e.refresh(), e.refresh())
        self.assertEqual((self.calls, len(self.saved)), (1, 1))

    async def test_restart_retains_history_but_starts_new_segment(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        await e.refresh()
        first = e.history("disk-a", "1", 7)["rows"][0]
        await e.stop()
        self.now += 1800
        other = self.engine()
        await other.start(self.saved[-1], file_exists=True)
        await other.refresh()
        rows = other.history("disk-a", "1", 7)["rows"]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0], first)
        self.assertNotEqual(rows[0]["segment_id"], rows[1]["segment_id"])

    async def test_source_error_clears_current_and_splits_recovery_segment(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        await e.refresh()
        first = e.history("disk-a", "1", 7)["rows"][0]
        self.now += 1800
        self.error = PermissionError("private path")
        await e.refresh()
        item = e.status()["sources"][0]
        self.assertIsNone(item["current"])
        self.assertEqual(item["forecast"]["reason"], "source_unavailable")
        self.assertNotIn("private path", str(item))
        self.now += 1800
        self.error = None
        await e.refresh()
        rows = e.history("disk-a", "1", 7)["rows"]
        self.assertEqual(len(rows), 2)
        self.assertNotEqual(first["segment_id"], rows[-1]["segment_id"])
        self.assertEqual(len(self.saved[-1]["failures"]["disk-a"]), 1)

    async def test_remount_identity_splits_segment(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        await e.refresh()
        self.now += 1800
        self.identity = "mount-b"
        await e.refresh()
        rows = e.history("disk-a", "1", 7)["rows"]
        self.assertNotEqual(rows[0]["segment_id"], rows[-1]["segment_id"])

    async def test_failed_save_latches_error_without_later_empty_flush(self):
        async def failed(payload):
            self.saved.append(copy.deepcopy(payload))
            raise OSError("disk full")
        e = self.engine(save=failed)
        await e.start(None, file_exists=False)
        with self.assertRaises(self.m.RuntimeUnavailable):
            await e.refresh()
        self.now += 1800
        with self.assertRaises(self.m.RuntimeUnavailable):
            await e.refresh()
        with self.assertRaises(self.m.RuntimeUnavailable):
            e.status()
        await e.stop()
        self.assertEqual((self.calls, len(self.saved)), (1, 1))

    async def test_stop_during_sample_prevents_late_save(self):
        entered, release = asyncio.Event(), asyncio.Event()
        original = self.sampler
        async def delayed(binding):
            entered.set()
            await release.wait()
            return await original(binding)
        e = self.m.StorageRuntime([BINDING], delayed, self.save, clock=lambda: self.now)
        await e.start(None, file_exists=False)
        pending = asyncio.create_task(e.refresh())
        await entered.wait()
        stop = asyncio.create_task(e.stop())
        await asyncio.sleep(0)
        release.set()
        await asyncio.gather(pending, stop)
        self.assertEqual(self.saved, [])
        with self.assertRaises(self.m.RuntimeUnavailable):
            e.status()

    async def test_wrong_revision_and_unknown_source_rejected(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        for source, revision in (("disk-a", "2"), ("other", "1")):
            with self.assertRaises(self.m.RuntimeUnavailable):
                e.history(source, revision, 7)

    async def test_status_does_not_expose_mutable_runtime_state(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        await e.refresh()
        dto = e.status()
        dto["sources"][0]["current"]["free_bytes"] = 0
        self.assertEqual(e.status()["sources"][0]["current"]["free_bytes"], 350)

    async def test_stale_current_is_not_presented_as_fresh(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        await e.refresh()
        self.now += 3601
        item = e.status()["sources"][0]
        self.assertIsNone(item["current"])
        self.assertEqual(item["forecast"]["reason"], "stale")

    async def test_pending_save_cannot_publish_unacknowledged_current(self):
        entered, release = asyncio.Event(), asyncio.Event()
        async def delayed_save(payload):
            entered.set()
            await release.wait()
            await self.save(payload)
        e = self.engine(save=delayed_save)
        await e.start(None, file_exists=False)
        pending = asyncio.create_task(e.refresh())
        await entered.wait()
        try:
            item = e.status()["sources"][0]
            self.assertIsNone(item["current"])
            self.assertEqual(e.history("disk-a", "1", 7)["rows"], [])
        finally:
            release.set()
            await pending
        self.assertIsNotNone(e.status()["sources"][0]["current"])

    async def test_clock_rollback_is_unknown_without_overwriting_history(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        await e.refresh()
        self.now -= 1
        await e.refresh()
        item = e.status()["sources"][0]
        self.assertIsNone(item["current"])
        self.assertEqual(item["forecast"]["reason"], "future_clock")
        self.assertEqual(len(self.saved), 1)

    async def test_cancelled_sample_separates_recovery_segment(self):
        e = self.engine()
        await e.start(None, file_exists=False)
        await e.refresh()
        first = e.history("disk-a", "1", 7)["rows"][0]
        self.now += 1800
        self.error = asyncio.CancelledError()
        with self.assertRaises(asyncio.CancelledError):
            await e.refresh()
        self.error = None
        self.now += 1800
        await e.refresh()
        rows = e.history("disk-a", "1", 7)["rows"]
        self.assertNotEqual(first["segment_id"], rows[-1]["segment_id"])


if __name__ == "__main__":
    unittest.main()
