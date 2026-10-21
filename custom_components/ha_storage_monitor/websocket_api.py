"""Read-only, current-admin Storage API. GET never creates a history sample."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.util import slugify

from .access import async_current_admin
from .const import DOMAIN
from .discovery import associate_system_monitor
from .filesystem import enumerate_sources
from .runtime import RuntimeUnavailable


def _integer(value):
    if type(value) is not int:
        raise vol.Invalid("Integer required")
    return value


def _coordinator(hass, entry_id):
    entries = hass.data.get(DOMAIN, {})
    if entry_id:
        return entries.get(entry_id)
    available = [coordinator for coordinator in entries.values() if coordinator.active]
    return available[0] if len(available) == 1 else None


async def _serve(hass, connection, msg, kind):
    user_id = getattr(connection.user, "id", None)
    if not await async_current_admin(hass, connection, user_id):
        connection.send_error(msg["id"], "unauthorized", "Active administrator required")
        return
    coordinator = _coordinator(hass, msg.get("entry_id"))
    if coordinator is None or not coordinator.active:
        connection.send_error(msg["id"], "unavailable", "Storage Monitor is not loaded")
        return
    try:
        if kind == "status":
            result = coordinator.engine.status()
        elif kind == "history":
            result = coordinator.engine.history(msg["source_uuid"], msg["binding_revision"], msg["days"])
            offset, limit = msg.get("offset", 0), msg.get("limit", 2400)
            count = len(result["rows"])
            result["rows"] = result["rows"][offset:offset+limit]
            result["next_offset"] = offset+limit if offset+limit < count else None
            result["total_rows"] = count
            result["page_offset"] = offset
        else:
            inventory = await hass.async_add_executor_job(enumerate_sources)
            registry = er.async_get(hass)
            entries = {entry.entry_id for entry in hass.config_entries.async_entries("systemmonitor")}
            associations = associate_system_monitor(
                [item["mountpoint"] for item in inventory], registry.entities.values(), entries, slugify)
            result = {"schema_version": 1, "sources": [
                {**item, "system_monitor": associations[item["mountpoint"]]}
                for item in inventory]}
    except (RuntimeUnavailable, OSError, ValueError):
        connection.send_error(msg["id"], "unavailable", "Storage source or history unavailable")
        return
    # Every asynchronous boundary (including auth lookup) is followed by a new
    # user and runtime identity check. Unload/reload cannot revive a late result.
    if not await async_current_admin(hass, connection, user_id):
        connection.send_error(msg["id"], "unauthorized", "Active administrator required")
        return
    if _coordinator(hass, msg.get("entry_id")) is not coordinator or not coordinator.active:
        connection.send_error(msg["id"], "unavailable", "Storage Monitor changed during read")
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/status", vol.Optional("entry_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_status(hass, connection, msg):
    await _serve(hass, connection, msg, "status")


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/history", vol.Optional("entry_id"): str,
    vol.Required("source_uuid"): vol.All(str, vol.Length(min=1, max=512)),
    vol.Required("binding_revision"): vol.All(str, vol.Length(min=1, max=512)),
    vol.Required("days"): vol.All(_integer, vol.In((7, 30))),
    vol.Optional("offset", default=0): vol.All(_integer, vol.Range(min=0, max=4096)),
    vol.Optional("limit", default=2400): vol.All(_integer, vol.Range(min=1, max=2400)),
})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_history(hass, connection, msg):
    await _serve(hass, connection, msg, "history")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/sources", vol.Optional("entry_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_sources(hass, connection, msg):
    await _serve(hass, connection, msg, "sources")


@callback
def async_register(hass):
    for command in (ws_status, ws_history, ws_sources):
        websocket_api.async_register_command(hass, command)
