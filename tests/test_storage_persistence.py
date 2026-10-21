"""Disk readback catches HA Store writes which only log a failure."""
import importlib
import asyncio
import json
from pathlib import Path
import tempfile
import threading
import unittest

from test_storage_runtime import PKG


class FilePersistenceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.m = importlib.import_module(f"{PKG}.persistence")
        cache = Path(__file__).resolve().parents[1] / ".pytest_cache"
        cache.mkdir(exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(prefix="storage-store-test-", dir=cache)
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "ha_storage_monitor.test"
        self.key = self.path.name

    def envelope(self, data):
        return {"version": 1, "minor_version": 1, "key": self.key, "data": data}

    async def executor(self, fn, *args):
        return fn(*args)

    async def write(self, data):
        self.path.write_text(json.dumps(self.envelope(data)))

    def store(self, writer=None):
        return self.m.VerifiedStore(self.path, self.key, writer or self.write, self.executor)

    async def test_new_file_and_disk_readback(self):
        store = self.store()
        self.assertEqual(await store.load(), (None, False))
        await store.save({"history": [1]})
        self.assertEqual(await self.store().load(), ({"history": [1]}, True))

    async def test_silently_failed_store_write_is_not_ack(self):
        async def noop(data):
            pass
        store = self.store(writer=noop)
        await store.load()
        with self.assertRaises(self.m.PersistenceError):
            await store.save({"history": [1]})
        with self.assertRaises(self.m.PersistenceError):
            await store.save({"history": []})
        self.assertFalse(self.path.exists())

    async def test_corrupt_null_duplicates_and_foreign_envelope_preserved(self):
        for raw in ("broken", "null", '{"version":1,"version":1}',
                    json.dumps(dict(self.envelope({}), key="foreign")),
                    json.dumps(dict(self.envelope({}), version=2)),
                    json.dumps(self.envelope(float("nan")))):
            self.path.write_text(raw)
            store = self.store()
            with self.subTest(raw=raw), self.assertRaises(self.m.PersistenceError):
                await store.load()
            self.assertEqual(self.path.read_text(), raw)
            with self.assertRaises(self.m.PersistenceError):
                await store.save({})
            self.assertEqual(self.path.read_text(), raw)

    async def test_external_change_prevents_overwrite(self):
        await self.write({"history": [1]})
        store = self.store()
        await store.load()
        await self.write({"history": [2]})
        with self.assertRaises(self.m.PersistenceError):
            await store.save({"history": [3]})
        self.assertEqual(json.loads(self.path.read_text())["data"], {"history": [2]})

    async def test_unexpected_file_creation_prevents_overwrite(self):
        store = self.store()
        await store.load()
        await self.write({"foreign": True})
        with self.assertRaises(self.m.PersistenceError):
            await store.save({})
        self.assertEqual(json.loads(self.path.read_text())["data"], {"foreign": True})

    async def test_repeated_successful_save_updates_expected_disk_identity(self):
        store = self.store()
        await store.load()
        await store.save({"history": [1]})
        await store.save({"history": [1, 2]})
        self.assertEqual(json.loads(self.path.read_text())["data"], {"history": [1, 2]})

    async def test_two_cancellations_drain_the_already_sent_disk_write(self):
        entered, release, finished = threading.Event(), threading.Event(), threading.Event()
        def blocking_write(data):
            entered.set()
            if not release.wait(5):
                raise TimeoutError("test release missing")
            self.path.write_text(json.dumps(self.envelope(data)))
            finished.set()
        async def writer(data):
            await asyncio.to_thread(blocking_write, data)
        store = self.store(writer=writer)
        await store.load()
        task = asyncio.create_task(store.save({"history": [1]}))
        self.assertTrue(await asyncio.to_thread(entered.wait, 2))
        task.cancel()
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        task.cancel()
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        returned_before_disk_write = task.done()
        release.set()
        with self.assertRaises(asyncio.CancelledError):
            await task
        # Join independent disk completion even on the RED implementation.
        self.assertTrue(await asyncio.to_thread(finished.wait, 2))
        self.assertFalse(returned_before_disk_write)
        self.assertEqual(json.loads(self.path.read_text())["data"], {"history": [1]})


if __name__ == "__main__":
    unittest.main()
