"""Serve public assets and own only registrations created by this runtime."""
from __future__ import annotations

from pathlib import Path
from copy import deepcopy
import asyncio
from uuid import uuid4

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig

from .const import CARD_URL, CONF_SHOW_PANEL, DOMAIN, NAME, PANEL_PATH, PANEL_URL, STATIC_BASE


async def async_reconcile_card(hass, receipt):
    """Add only our transient module after all other copies have gone away."""
    async with receipt["lock"]:
        if receipt["closed"]:
            return "unavailable"
        return await _async_reconcile_card(hass, receipt)


async def _async_reconcile_card(hass, receipt):
    lovelace = hass.data.get("lovelace")
    resources = (getattr(lovelace, "resources", None) if lovelace is not None else None)
    if resources is None and isinstance(lovelace, dict):
        resources = lovelace.get("resources")
    mode = getattr(lovelace, "resource_mode", None) or getattr(lovelace, "mode", None)
    if isinstance(lovelace, dict):
        mode = mode or lovelace.get("resource_mode") or lovelace.get("mode")
    if resources is None or mode == "yaml":
        return "manual_required"
    if not getattr(resources, "loaded", True):
        await resources.async_load()
    if receipt["closed"]:
        return "unavailable"
    extra_modules = hass.data.get(frontend.DATA_EXTRA_MODULE_URL)
    urls = [url for url in (getattr(extra_modules, "urls", extra_modules) or ())
            if url != receipt["extra_url"]]
    urls.extend(item.get("url", "") for item in resources.async_items())
    existing = [url for url in urls if isinstance(url, str)
                and url.split("?", 1)[0].rsplit("/", 1)[-1] == "ha-storage-monitor.js"]
    if existing:
        if receipt["extra_url"]:
            frontend.remove_extra_js_url(hass, receipt["extra_url"])
            receipt["extra_url"] = None
        if len(existing) == 1 and existing[0].split("?", 1)[0] == CARD_URL.split("?", 1)[0]:
            return "existing_resource"
        return "migration_required"
    if not receipt["extra_url"]:
        receipt["extra_url"] = f"{CARD_URL}&storage_owner={uuid4().hex}"
        frontend.add_extra_js_url(hass, receipt["extra_url"])
    return "registered"


async def async_register(hass, entry):
    """Never update/delete a foreign resource, even one with our basename."""
    static_key = f"{DOMAIN}_static_registered"
    if not hass.data.get(static_key):
        await hass.http.async_register_static_paths([
            StaticPathConfig(STATIC_BASE, str(Path(__file__).parent / "www"), cache_headers=False)])
        hass.data[static_key] = True
    receipt = {"extra_url": None, "panel": None, "panel_snapshot": None,
               "lock": asyncio.Lock(), "closed": False}
    receipt["result"] = await async_reconcile_card(hass, receipt)
    if entry.options.get(CONF_SHOW_PANEL, entry.data.get(CONF_SHOW_PANEL, True)):
        panels = hass.data.get(frontend.DATA_PANELS, {})
        if PANEL_PATH not in panels:
            try:
                await panel_custom.async_register_panel(
                    hass, frontend_url_path=PANEL_PATH, webcomponent_name="ha-storage-monitor-panel",
                    sidebar_title=NAME, sidebar_icon="mdi:harddisk", module_url=PANEL_URL,
                    embed_iframe=False, require_admin=True,
                    config={"entry_id": entry.entry_id, "card_url": receipt["extra_url"]})
                receipt["panel"] = hass.data[frontend.DATA_PANELS].get(PANEL_PATH)
                receipt["panel_snapshot"] = deepcopy(receipt["panel"].to_response())
            except BaseException:
                if receipt["extra_url"]:
                    frontend.remove_extra_js_url(hass, receipt["extra_url"])
                raise
    return receipt


async def async_unregister(hass, receipt):
    """Remove the exact token URL/object this runtime added, with drift fencing."""
    receipt["closed"] = True
    async with receipt["lock"]:
        url = receipt.get("extra_url")
        extra_modules = hass.data.get(frontend.DATA_EXTRA_MODULE_URL)
        if url and url in (getattr(extra_modules, "urls", extra_modules) or ()):
            frontend.remove_extra_js_url(hass, url)
        panel = receipt.get("panel")
        if (panel is not None and hass.data.get(frontend.DATA_PANELS, {}).get(PANEL_PATH) is panel
                and panel.to_response() == receipt.get("panel_snapshot")):
            frontend.async_remove_panel(hass, PANEL_PATH, warn_if_unknown=False)
