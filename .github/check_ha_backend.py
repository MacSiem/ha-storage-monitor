"""Read-only compatibility probe in an isolated real HA image, never live config.

Run with repository mounted at /work, network disabled, and normal build FIFO.
Does not substitute for HACS/UI/migration or tests of the running HA integration.
"""
from importlib import import_module
import json
from pathlib import Path
import sys

sys.path.insert(0, "/work")

from homeassistant.const import __version__ as HA_VERSION
from custom_components.ha_storage_monitor import const
from custom_components.ha_storage_monitor.filesystem import enumerate_sources, sample_source
from custom_components.ha_storage_monitor.model import Sample

MODULES = ("config_flow", "coordinator", "frontend", "sensor", "websocket_api")
for name in MODULES:
    import_module(f"custom_components.ha_storage_monitor.{name}")
manifest = json.loads(Path("/work/custom_components/ha_storage_monitor/manifest.json").read_text())
assert manifest["domain"] == const.DOMAIN and manifest["version"] == const.VERSION
assert manifest["requirements"] == []
inventory = enumerate_sources()
assert inventory, "No readable process filesystems in isolated image"
sample = sample_source(inventory[0])
validated = Sample("probe", "1", "probe-boot", "probe-sample", sample["timestamp"],
                   sample["used_bytes"], sample["total_bytes"], sample["free_bytes"],
                   sample["reserved_bytes"])
assert validated.free_bytes >= 0
print(json.dumps({"ha_version": HA_VERSION, "modules_imported": len(MODULES)+1,
                  "manifest_parity": True, "process_filesystem_sample": "VALID",
                  "native_setup_hacs_ui": "NOT_TESTED"}))
