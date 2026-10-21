"""Storage Monitor: local measured history and conservative disk forecasts."""
from __future__ import annotations

from homeassistant.const import Platform
from homeassistant.exceptions import ConfigEntryError
from homeassistant.helpers import config_validation as cv

from . import frontend, websocket_api
from .const import DOMAIN
from .coordinator import StorageCoordinator
from .persistence import PersistenceError
from .runtime import RuntimeUnavailable

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
PLATFORMS = [Platform.SENSOR]


async def async_setup(hass, config):
    return True


async def async_setup_entry(hass, entry):
    coordinator = StorageCoordinator(hass, entry)
    entry.runtime_data = coordinator
    receipt = None
    forwarded = False
    try:
        await coordinator.async_start()
        if not hass.data.get(f"{DOMAIN}_ws_registered"):
            websocket_api.async_register(hass)
            hass.data[f"{DOMAIN}_ws_registered"] = True
        hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        forwarded = True
        receipt = await frontend.async_register(hass, entry)
    except BaseException as err:
        hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
        await coordinator.async_stop()
        if forwarded:
            await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
        if receipt:
            frontend.async_unregister(hass, receipt)
        if isinstance(err, (RuntimeUnavailable, PersistenceError)):
            raise ConfigEntryError("Stored history is unavailable; preserve it and restore a verified backup") from err
        raise
    coordinator.frontend_receipt = receipt
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def _async_options_updated(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    coordinator = entry.runtime_data
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    # Invalidate API identity before waiting for a possibly already sent save.
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    await coordinator.async_stop()
    frontend.async_unregister(hass, coordinator.frontend_receipt)
    return True


async def async_remove_entry(hass, entry):
    # Keep the measured Store as a recovery source. Removing/re-adding an entry
    # must never silently erase history, including a corrupt original file.
    return None
