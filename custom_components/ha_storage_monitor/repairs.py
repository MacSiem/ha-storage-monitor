"""Guide an administrator through removing an old dashboard resource."""
import voluptuous as vol

from homeassistant.components.repairs import RepairsFlow

from . import frontend
from .const import DOMAIN


class LegacyCardResourceFlow(RepairsFlow):
    async def async_step_init(self, user_input=None):
        errors = {}
        if user_input is not None:
            entries = [c for c in self.hass.data.get(DOMAIN, {}).values()
                       if c.active and getattr(c, "frontend_receipt", None)]
            if len(entries) != 1:
                errors["base"] = "unavailable"
            else:
                result = await frontend.async_reconcile_card(self.hass, entries[0].frontend_receipt)
                if result in ("registered", "existing_resource"):
                    return self.async_create_entry(title="", data={})
                errors["base"] = {"migration_required": "legacy_resource_remains",
                                  "manual_required": "resources_unavailable"}.get(result, "unavailable")
        return self.async_show_form(step_id="init", data_schema=vol.Schema({}), errors=errors)


async def async_create_fix_flow(hass, issue_id, data):
    return LegacyCardResourceFlow()
