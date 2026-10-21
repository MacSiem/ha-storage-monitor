"""Serve public assets and own only registrations created by this runtime."""
from __future__ import annotations

from pathlib import Path
from copy import deepcopy
from uuid import uuid4

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig

from .const import CARD_URL, CONF_SHOW_PANEL, DOMAIN, NAME, PANEL_PATH, PANEL_URL, STATIC_BASE


async def async_register(hass, entry):
    """Never update/delete a foreign resource, even one with our basename."""
    static_key = f"{DOMAIN}_static_registered"
    if not hass.data.get(static_key):
        await hass.http.async_register_static_paths([
            StaticPathConfig(STATIC_BASE, str(Path(__file__).parent / "www"), cache_headers=False)])
        hass.data[static_key] = True
    lovelace = hass.data.get("lovelace")
    resources = (getattr(lovelace, "resources", None) if lovelace is not None else None)
    if resources is None and isinstance(lovelace, dict):
        resources = lovelace.get("resources")
    urls = set(hass.data.get(frontend.DATA_EXTRA_MODULE_URL, set()))
    if resources is not None:
        if not getattr(resources, "loaded", True):
            await resources.async_load()
        urls.update(item.get("url", "") for item in resources.async_items())
    existing = any(url.split("?", 1)[0].rsplit("/", 1)[-1] == "ha-storage-monitor.js" for url in urls)
    owned_url = None
    if not existing:
        owned_url = f"{CARD_URL}&storage_owner={uuid4().hex}"
        frontend.add_extra_js_url(hass, owned_url)
    receipt = {"extra_url": owned_url, "panel": None, "panel_snapshot": None}
    if entry.options.get(CONF_SHOW_PANEL, entry.data.get(CONF_SHOW_PANEL, True)):
        panels = hass.data.get(frontend.DATA_PANELS, {})
        if PANEL_PATH not in panels:
            try:
                await panel_custom.async_register_panel(
                    hass, frontend_url_path=PANEL_PATH, webcomponent_name="ha-storage-monitor-panel",
                    sidebar_title=NAME, sidebar_icon="mdi:harddisk", module_url=PANEL_URL,
                    embed_iframe=False, require_admin=True,
                    config={"entry_id": entry.entry_id, "card_url": owned_url})
                receipt["panel"] = hass.data[frontend.DATA_PANELS].get(PANEL_PATH)
                receipt["panel_snapshot"] = deepcopy(receipt["panel"].to_response())
            except BaseException:
                if owned_url:
                    frontend.remove_extra_js_url(hass, owned_url)
                raise
    return receipt


def async_unregister(hass, receipt):
    """Remove the exact token URL/object this runtime added, with drift fencing."""
    url = receipt.get("extra_url")
    if url and url in hass.data.get(frontend.DATA_EXTRA_MODULE_URL, set()):
        frontend.remove_extra_js_url(hass, url)
    panel = receipt.get("panel")
    if (panel is not None and hass.data.get(frontend.DATA_PANELS, {}).get(PANEL_PATH) is panel
            and panel.to_response() == receipt.get("panel_snapshot")):
        frontend.async_remove_panel(hass, PANEL_PATH, warn_if_unknown=False)
