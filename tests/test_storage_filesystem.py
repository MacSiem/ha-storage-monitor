"""Real mount table/atomic statvfs contract, without HA or host disk access."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import SimpleNamespace
import stat
import unittest

PATH = Path(__file__).resolve().parents[1] / "custom_components/ha_storage_monitor/filesystem.py"


def load_module():
    spec = spec_from_file_location("storage_filesystem", PATH)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


TABLE = """24 1 8:1 / / rw - ext4 /dev/sda1 rw
25 24 8:1 /config /config rw - ext4 /dev/sda1 rw
26 24 0:7 / /proc rw - proc proc rw
27 24 8:2 / /media/My\\040Disk rw - ext4 /dev/sdb1 rw
28 24 0:8 / /tmp rw - tmpfs tmpfs rw
"""


class FilesystemTests(unittest.TestCase):
    def setUp(self):
        self.m = load_module()
        self.mounts = self.m.parse_mountinfo(TABLE)

    def binding(self):
        return self.mounts["/config"]

    def sample(self, **changes):
        calls = []
        params = dict(read_mounts=lambda: self.mounts,
                      stat=lambda path: SimpleNamespace(st_dev=2049, st_mode=stat.S_IFDIR | 0o700),
                      statvfs=lambda path: calls.append(path) or SimpleNamespace(
                          f_blocks=1000, f_bfree=400, f_bavail=350, f_frsize=4096),
                      clock=lambda: 1234.5, namespace=lambda: "mnt:[42]")
        params.update(changes)
        result = self.m.sample_source(self.binding(), **params)
        return result, calls

    def test_mount_parser_decodes_paths_and_excludes_pseudo(self):
        self.assertEqual(set(self.mounts), {"/", "/config", "/media/My Disk"})
        self.assertEqual(self.mounts["/media/My Disk"]["mountpoint"], "/media/My Disk")

    def test_ambiguous_mounts_are_never_selected(self):
        table = TABLE + "99 24 8:3 / /config rw - ext4 /dev/sdc1 rw\n"
        self.assertNotIn("/config", self.m.parse_mountinfo(table))

    def test_malformed_and_relative_mounts_ignored(self):
        self.assertEqual(self.m.parse_mountinfo("broken\n1 2 8:1 / relative rw - ext4 disk rw"), {})

    def test_one_atomic_call_keeps_actual_available_and_reserved(self):
        result, calls = self.sample()
        self.assertEqual(calls, ["/config"])
        self.assertEqual(result["used_bytes"], 600 * 4096)
        self.assertEqual(result["total_bytes"], 1000 * 4096)
        self.assertEqual(result["free_bytes"], 350 * 4096)
        self.assertEqual(result["reserved_bytes"], 50 * 4096)
        self.assertEqual(result["timestamp"], 1234.5)
        self.assertEqual(result["free_semantics"], "available_to_process")
        self.assertEqual(result["scope"], "ha_process_filesystem")
        self.assertEqual(len(result["identity"]), 64)

    def test_arbitrary_path_never_read(self):
        binding = dict(self.binding(), mountpoint="/etc/private")
        touched = []
        with self.assertRaises(self.m.SourceUnavailable):
            self.m.sample_source(binding, read_mounts=lambda: self.mounts,
                                 stat=lambda path: touched.append(path))
        self.assertEqual(touched, [])

    def test_replaced_binding_requires_confirmation(self):
        changed = {**self.mounts, "/config": dict(self.binding(), device="/dev/new")}
        with self.assertRaises(self.m.SourceChanged):
            self.sample(read_mounts=lambda: changed)

    def test_remount_during_sampling_rejects_result(self):
        after = {**self.mounts, "/config": dict(self.binding(), mount_id="123")}
        snapshots = iter([self.mounts, after])
        with self.assertRaises(self.m.SourceChanged):
            self.sample(read_mounts=lambda: next(snapshots))

    def test_namespace_change_rejects_result(self):
        ns = iter(["mnt:[1]", "mnt:[2]"])
        with self.assertRaises(self.m.SourceChanged):
            self.sample(namespace=lambda: next(ns))

    def test_device_change_during_sampling_rejects_result(self):
        states = iter([SimpleNamespace(st_dev=2049, st_mode=stat.S_IFDIR),
                       SimpleNamespace(st_dev=2050, st_mode=stat.S_IFDIR)])
        with self.assertRaises(self.m.SourceChanged):
            self.sample(stat=lambda path: next(states))

    def test_file_bind_mount_is_not_a_filesystem_directory_source(self):
        with self.assertRaises(self.m.SourceUnavailable):
            self.sample(stat=lambda path: SimpleNamespace(st_dev=2049, st_mode=stat.S_IFREG))

    def test_capacity_invalid_never_zero_fallback(self):
        for values in [(0, 0, 0, 4096), (1000, 400, -1, 4096),
                       (1000, 400, 401, 4096), (1000, 1001, 1, 4096),
                       (1000, 400, 350, 0)]:
            with self.subTest(values=values), self.assertRaises(self.m.SourceUnavailable):
                self.sample(statvfs=lambda path: SimpleNamespace(
                    **dict(zip(("f_blocks", "f_bfree", "f_bavail", "f_frsize"), values))))

    def test_io_failure_is_unavailable(self):
        def denied(path):
            raise PermissionError("private host path must not reach error text")
        with self.assertRaises(self.m.SourceUnavailable) as caught:
            self.sample(statvfs=denied)
        self.assertNotIn("private host", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
