"""Optional duration estimates; occupancy remains with System Monitor."""
from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import UnitOfTime
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_NATIVE_FORECAST, DOMAIN, NAME
from .runtime import RuntimeUnavailable


async def async_setup_entry(hass, entry, async_add_entities):
    if entry.options.get(CONF_NATIVE_FORECAST, entry.data.get(CONF_NATIVE_FORECAST, False)):
        coordinator = entry.runtime_data
        async_add_entities(StorageForecastSensor(coordinator, binding)
                           for binding in coordinator.engine.bindings)


class StorageForecastSensor(CoordinatorEntity, SensorEntity):
    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.DURATION
    _attr_native_unit_of_measurement = UnitOfTime.DAYS
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:harddisk"
    _attr_translation_key = "full_in_days"

    def __init__(self, coordinator, binding):
        super().__init__(coordinator)
        self._source_uuid = binding["source_uuid"]
        self._attr_unique_id = f"{self._source_uuid}_full_in_days"
        self._attr_translation_placeholders = {"filesystem": binding.get("label", binding["mountpoint"])}
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, coordinator.entry.entry_id)},
            entry_type=DeviceEntryType.SERVICE, name=NAME, manufacturer="MacSiem")

    def _item(self):
        try:
            return next(item for item in self.coordinator.engine.status()["sources"]
                        if item["source"]["source_uuid"] == self._source_uuid)
        except (RuntimeUnavailable, StopIteration):
            return None

    @property
    def available(self):
        item = self._item()
        return super().available and self.coordinator.active and bool(item and item["current"])

    @property
    def native_value(self):
        item = self._item()
        return item["forecast"]["full_in_days"] if item else None

    @property
    def extra_state_attributes(self):
        item = self._item()
        if item is None:
            return {"quality": "unknown", "reason": "source_unavailable"}
        result = item["forecast"]
        return {key: result[key] for key in
                ("quality", "reason", "sample_count", "method", "measured_at")}
