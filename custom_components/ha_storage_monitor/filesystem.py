"""Atomic, read-only samples of filesystems visible to the HA process.

Linux mountinfo is an allowlist, not a claim about Supervisor/host/NAS disks.
One statvfs call provides total, used and *available* free independently, using
the POSIX semantics also used by psutil. No external psutil version is required.
All functions run in the HA executor. No shell, recursive traversal or writes.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import time
from typing import Callable

_SKIP = frozenset({"proc", "sysfs", "tmpfs", "devtmpfs", "devpts", "cgroup",
                   "cgroup2", "securityfs", "debugfs", "tracefs", "pstore",
                   "mqueue", "hugetlbfs", "configfs", "fusectl", "autofs"})
_BINDING_KEYS = ("mountpoint", "root", "major_minor", "fstype", "device")
_OCTAL = re.compile(r"\\([0-7]{3})")


class SourceUnavailable(Exception):
    """Source absent, unreadable or invalid. Messages never contain host paths."""


class SourceChanged(SourceUnavailable):
    """The confirmed binding changed; require explicit source confirmation."""


def _unescape(value: str) -> str:
    return _OCTAL.sub(lambda match: chr(int(match.group(1), 8)), value)


def parse_mountinfo(text: str) -> dict[str, dict]:
    """Parse the process mount namespace; discard ambiguous and pseudo mounts."""
    result: dict[str, dict] = {}
    ambiguous: set[str] = set()
    for line in text.splitlines():
        try:
            left, right = line.split(" - ", 1)
            parts, fs = left.split(), right.split()
            if len(parts) < 6 or len(fs) < 3 or not parts[0].isdigit():
                continue
            mountpoint, root = _unescape(parts[4]), _unescape(parts[3])
            if (not mountpoint.startswith("/") or not root.startswith("/")
                    or "\x00" in mountpoint or fs[0] in _SKIP
                    or not re.fullmatch(r"\d+:\d+", parts[2])):
                continue
            if mountpoint in result or mountpoint in ambiguous:
                result.pop(mountpoint, None)
                ambiguous.add(mountpoint)
                continue
            result[mountpoint] = {
                "mountpoint": mountpoint, "root": root,
                "major_minor": parts[2], "fstype": fs[0],
                "device": _unescape(fs[1]), "mount_id": parts[0],
            }
        except (ValueError, IndexError):
            continue
    return result


def read_mounts() -> dict[str, dict]:
    """Return only the current process's Linux mounts."""
    try:
        return parse_mountinfo(Path("/proc/self/mountinfo").read_text(encoding="utf-8"))
    except (OSError, UnicodeError) as err:
        raise SourceUnavailable("mount_namespace_unavailable") from err


def _namespace() -> str:
    return os.readlink("/proc/self/ns/mnt")


def _binding_identity(mount: dict) -> tuple:
    return tuple(mount.get(key) for key in _BINDING_KEYS)


def _runtime_identity(mount: dict, device: int, namespace: str) -> str:
    payload = [_binding_identity(mount), mount["mount_id"], device, namespace]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=True).encode()).hexdigest()


def sample_source(binding: dict, *, read_mounts: Callable = read_mounts,
                  stat: Callable = os.stat, statvfs: Callable = os.statvfs,
                  clock: Callable = time.time, namespace: Callable = _namespace) -> dict:
    """Sample one confirmed enumerated mount, fenced before/after the syscall.

    Binding equality deliberately excludes ephemeral mount ID. The sample's
    runtime identity includes it (and namespace/st_dev), so a remount or restart
    cannot silently extend a previous forecasting segment. This is *not* a
    physical disk UUID and must not be presented as one.
    """
    try:
        path = binding.get("mountpoint")
        before = read_mounts().get(path)
        if before is None:
            raise SourceUnavailable("source_not_mounted")
        if _binding_identity(before) != _binding_identity(binding):
            raise SourceChanged("source_binding_changed")
        namespace_before = namespace()
        device_before = stat(path).st_dev
        identity = _runtime_identity(before, device_before, namespace_before)
        usage = statvfs(path)
        measured_at = clock()
        after = read_mounts().get(path)
        namespace_after = namespace()
        device_after = stat(path).st_dev
        if after is None or _runtime_identity(after, device_after, namespace_after) != identity:
            raise SourceChanged("source_changed_during_sample")
        values = (usage.f_blocks, usage.f_bfree, usage.f_bavail, usage.f_frsize)
        if any(type(value) is not int for value in values):
            raise SourceUnavailable("invalid_capacity")
        blocks, free_blocks, available_blocks, block_size = values
        if not (blocks > 0 and block_size > 0
                and 0 <= available_blocks <= free_blocks <= blocks):
            raise SourceUnavailable("invalid_capacity")
        total = blocks * block_size
        used = (blocks - free_blocks) * block_size
        free = available_blocks * block_size
        return {"timestamp": measured_at, "identity": identity,
                "total_bytes": total, "used_bytes": used, "free_bytes": free,
                "reserved_bytes": total - used - free,
                "free_semantics": "available_to_process",
                "scope": "ha_process_filesystem"}
    except SourceUnavailable:
        raise
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as err:
        raise SourceUnavailable("filesystem_read_failed") from err


def enumerate_sources() -> list[dict]:
    """Discover readable mounts; no arbitrary paths and no guessed entity names."""
    sources = []
    for binding in read_mounts().values():
        try:
            sample = sample_source(binding)
        except SourceUnavailable:
            continue
        sources.append({**binding, "scope": sample["scope"],
                        "identity_quality": "process_mount_namespace",
                        "total_bytes": sample["total_bytes"]})
    return sorted(sources, key=lambda source: source["mountpoint"])
