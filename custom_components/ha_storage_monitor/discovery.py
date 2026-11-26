"""Conservative association with existing System Monitor registry entries.

No private System Monitor imports, name inference, enabling entities, or copying
occupancy sensors. Mounts come from our enumerated process namespace. The public
registry unique-ID formula is evaluated in the forward direction, with collision
checks across the *whole* mount inventory (not only the selected mount).
"""
from __future__ import annotations

from collections import Counter
from typing import Callable, Iterable

_KINDS = {"used": "disk_use", "free": "disk_free", "percent": "disk_use_percent"}


def associate_system_monitor(mountpoints: Iterable[str], registry_entries: Iterable,
                             config_entry_ids: set[str], slugify: Callable) -> dict:
    """Return explicit active/disabled IDs, or an honest unavailable reason."""
    mounts = list(dict.fromkeys(mountpoints))
    expected = {(mount, kind): slugify(f"{key}_{mount}")
                for mount in mounts for kind, key in _KINDS.items()}
    counts = Counter(expected.values())
    entries: dict[str, list] = {}
    for entry in registry_entries:
        if (entry.platform == "systemmonitor"
                and entry.config_entry_id in config_entry_ids
                and entry.entity_id.startswith("sensor.")):
            entries.setdefault(entry.unique_id, []).append(entry)
    results = {}
    for mount in mounts:
        active, disabled, ambiguous = {}, {}, False
        for kind in _KINDS:
            unique_id = expected[mount, kind]
            candidates = entries.get(unique_id, [])
            if counts[unique_id] != 1 or len(candidates) > 1:
                ambiguous = True
                break
            if candidates:
                entry = candidates[0]
                (disabled if entry.disabled_by is not None else active)[kind] = entry.entity_id
        if ambiguous:
            active, disabled = {}, {}
        results[mount] = {
            "entity_ids": active, "disabled_entity_ids": disabled,
            "reason": "ambiguous_registry_identity" if ambiguous else
                      "matched" if active else "entities_disabled" if disabled else
                      "no_matching_entities",
        }
    return results
