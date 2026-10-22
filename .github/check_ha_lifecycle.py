"""Real HA boot/setup/unload probe on a disposable config, never production."""
import asyncio
import json
from pathlib import Path
import shutil
import tempfile

from homeassistant import bootstrap, loader
from homeassistant.core import HomeAssistant
from homeassistant.const import __version__ as HA_VERSION


async def probe(config_dir):
    hass = HomeAssistant(str(config_dir))
    loader.async_setup(hass)
    hass.config.skip_pip = True
    try:
        configured = await bootstrap.async_from_config_dict({
            "homeassistant": {"name": "Storage isolated QA", "time_zone": "UTC",
                              "latitude": 0, "longitude": 0, "elevation": 0,
                              "unit_system": "metric", "country": "PL"},
            "http": {"server_host": "127.0.0.1", "server_port": 18129},
        }, hass)
        assert configured is hass, "Core bootstrap failed"
        form = await hass.config_entries.flow.async_init("ha_storage_monitor", context={"source": "user"})
        assert form["type"] == "form", form
        inventory = form["data_schema"].schema
        field = next(value for key, value in inventory.items() if str(key) == "mountpoints")
        mountpoint = field.config["options"][0]
        result = await hass.config_entries.flow.async_configure(form["flow_id"], {
            "mountpoints": [mountpoint], "show_panel": True, "native_forecast": True})
        assert result["type"] == "create_entry", result
        entry = result["result"]
        await hass.async_block_till_done()
        assert entry.state.value == "loaded", f"Pre-start setup: {entry.state.value}: {entry.reason}"
        await hass.async_start()
        await hass.async_block_till_done()
        coordinator = entry.runtime_data
        assert coordinator.active
        status = coordinator.engine.status()
        assert len(status["sources"]) == 1
        assert status["sources"][0]["current"] is not None
        assert Path(coordinator._store.path).is_file(), "First sample not persisted"
        sensors = [state for state in hass.states.async_all("sensor")
                   if state.attributes.get("device_class") == "duration"]
        assert len(sensors) == 1, sensors
        assert sensors[0].state == "unknown", "A fresh source cannot have a known forecast"
        assert sensors[0].attributes["unit_of_measurement"] == "d"
        assert await hass.config_entries.async_unload(entry.entry_id)
        assert not coordinator.active
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        assert entry.state.value == "loaded"
        print(json.dumps({"ha_version": HA_VERSION, "flow_boot_setup": "PASS",
                          "native_duration": "PASS", "store_reload": "PASS",
                          "hacs_browser_production": "NOT_TESTED"}), flush=True)
    finally:
        await hass.async_stop(force=True)


with tempfile.TemporaryDirectory(prefix="storage-core-", dir="/qa") as directory:
    config_dir = Path(directory)
    shutil.copytree("/work/custom_components", config_dir / "custom_components",
                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    asyncio.run(asyncio.wait_for(probe(config_dir), timeout=120))
