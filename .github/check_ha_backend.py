"""Read-only compatibility probe in an isolated real HA image, never live config.

Run with repository mounted at /work, network disabled, and normal build FIFO.
Does not substitute for HACS/UI/migration or tests of the running HA integration.
"""
from importlib import import_module
from copy import deepcopy
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.path.insert(0, "/work")

from homeassistant.const import __version__ as HA_VERSION
from custom_components.ha_storage_monitor import const
from custom_components.ha_storage_monitor.filesystem import enumerate_sources, sample_source
from custom_components.ha_storage_monitor.model import Sample
from custom_components.ha_storage_monitor import frontend as storage_frontend
from homeassistant.components import frontend

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
def panel_object():
    return frontend.Panel("custom", const.NAME, "mdi:harddisk", True, const.PANEL_PATH,
                          {"entry_id": "probe-entry", "storage_owner": "probe-token"}, True, None, True)
panel = panel_object()
fake_hass = SimpleNamespace(data={frontend.DATA_PANELS: {const.PANEL_PATH: panel},
                                  frontend.DATA_EXTRA_MODULE_URL: frontend.UrlManager(lambda *args: None, [])},
                            bus=SimpleNamespace(async_fire=lambda *args: None))
receipt = {"panel": panel, "panel_snapshot": deepcopy(panel.to_response()), "extra_url": None}
panel.config["foreign_change"] = True
storage_frontend.async_unregister(fake_hass, receipt)
assert fake_hass.data[frontend.DATA_PANELS].get(const.PANEL_PATH) is panel, "Foreign in-place panel edits must survive"
panel = panel_object()
fake_hass.data[frontend.DATA_PANELS][const.PANEL_PATH] = panel
receipt = {"panel": panel, "panel_snapshot": deepcopy(panel.to_response()), "extra_url": None}
storage_frontend.async_unregister(fake_hass, receipt)
assert const.PANEL_PATH not in fake_hass.data[frontend.DATA_PANELS], "Unchanged owned panel must unload"
urls = fake_hass.data[frontend.DATA_EXTRA_MODULE_URL]
urls.add("/foreign-card.js")
urls.add("/storage-owned.js")
storage_frontend.async_unregister(fake_hass, {"extra_url": "/storage-owned.js"})
assert urls.urls == frozenset({"/foreign-card.js"}), "Only the owned URL may be removed"
print(json.dumps({"ha_version": HA_VERSION, "modules_imported": len(MODULES)+1,
                  "manifest_parity": True, "process_filesystem_sample": "VALID",
                  "real_core_panel_contract": "PASS",
                  "native_setup_hacs_ui": "NOT_TESTED"}))
