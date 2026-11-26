"""User confirmation binds only currently enumerated, unambiguous sources."""
from __future__ import annotations

from uuid import uuid4

_KEYS = ("mountpoint", "root", "major_minor", "fstype", "device")


def confirm_bindings(inventory, selected, previous):
    """Preserve a confirmed logical ID only while its source identity matches."""
    if (not isinstance(selected, (list, tuple)) or not 1 <= len(selected) <= 32
            or any(not isinstance(path, str) for path in selected)
            or len(set(selected)) != len(selected)):
        raise ValueError("invalid_source_selection")
    by_path = {}
    for item in inventory:
        path = item["mountpoint"]
        if path in by_path:
            raise ValueError("ambiguous_source_inventory")
        by_path[path] = item
    output = []
    for path in selected:
        item = by_path.get(path)
        if item is None:
            raise ValueError("source_not_available")
        identity = tuple(item.get(key) for key in _KEYS)
        if any(not isinstance(value, str) or not value for value in identity):
            raise ValueError("invalid_source_identity")
        matching = [old for old in previous if tuple(old.get(key) for key in _KEYS) == identity]
        old = matching[0] if len(matching) == 1 else None
        output.append({**{key: item[key] for key in _KEYS},
                       "source_uuid": old["source_uuid"] if old else uuid4().hex,
                       "binding_revision": old["binding_revision"] if old else "1",
                       "label": path})
    return output
