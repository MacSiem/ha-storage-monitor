"""Explicit local filesystem selection and optional native forecast exposure."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.selector import SelectSelector, SelectSelectorConfig

from .bindings import confirm_bindings
from .const import CONF_BINDINGS, CONF_NATIVE_FORECAST, CONF_SHOW_PANEL, DOMAIN, NAME
from .filesystem import SourceUnavailable, enumerate_sources


async def _form(handler, step_id, user_input, previous, options):
    errors = {}
    try:
        inventory = await handler.hass.async_add_executor_job(enumerate_sources)
    except SourceUnavailable:
        inventory = []
    if not inventory:
        return handler.async_abort(reason="no_readable_sources")
    if user_input is not None:
        try:
            bindings = confirm_bindings(inventory, user_input.get("mountpoints"), previous)
        except ValueError:
            errors["base"] = "source_changed"
        else:
            return handler.async_create_entry(
                title=NAME if step_id == "user" else "",
                data={CONF_BINDINGS: bindings,
                      CONF_NATIVE_FORECAST: user_input.get(CONF_NATIVE_FORECAST, False),
                      CONF_SHOW_PANEL: user_input.get(CONF_SHOW_PANEL, True)})
    available = [item["mountpoint"] for item in inventory]
    selected = [b["mountpoint"] for b in previous if b["mountpoint"] in available]
    if not selected and len(available) == 1:
        selected = available
    return handler.async_show_form(step_id=step_id, errors=errors, data_schema=vol.Schema({
        vol.Required("mountpoints", default=selected): SelectSelector(SelectSelectorConfig(
            options=available, multiple=True, custom_value=False)),
        vol.Required(CONF_SHOW_PANEL, default=options.get(CONF_SHOW_PANEL, True)): bool,
        vol.Required(CONF_NATIVE_FORECAST, default=options.get(CONF_NATIVE_FORECAST, False)): bool,
    }))


class StorageConfigFlow(ConfigFlow, domain=DOMAIN):
    """One integration; several explicitly confirmed readable filesystems."""
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return await _form(self, "user", user_input, [], {})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return StorageOptionsFlow()


class StorageOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input=None):
        options = {**self.config_entry.data, **self.config_entry.options}
        return await _form(self, "init", user_input, options.get(CONF_BINDINGS, []), options)
