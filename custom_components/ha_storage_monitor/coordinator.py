"""HA scheduling and executor glue for the tested Storage engine."""
from __future__ import annotations

from datetime import timedelta
import logging

from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import CoreState
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import CONF_BINDINGS, DOMAIN
from .filesystem import sample_source
from .persistence import VerifiedStore
from .runtime import RuntimeUnavailable, StorageRuntime

_LOGGER = logging.getLogger(__name__)


class StorageCoordinator(DataUpdateCoordinator):
    """Explicit timer samples even when the optional native entity is disabled."""

    def __init__(self, hass, entry):
        super().__init__(hass, _LOGGER, name=DOMAIN, config_entry=entry)
        self.entry = entry
        self._store = Store(hass, 1, f"{DOMAIN}.{entry.entry_id}", private=True, atomic_writes=True)
        self._verified = VerifiedStore(self._store.path, self._store.key,
                                       self._async_save, hass.async_add_executor_job)
        bindings = entry.options.get(CONF_BINDINGS, entry.data.get(CONF_BINDINGS, []))
        self.engine = StorageRuntime(bindings, self._async_sample, self._verified.save)
        self._cancel_timer = None
        self._cancel_stop = None
        self.active = False

    async def _async_sample(self, binding):
        return await self.hass.async_add_executor_job(sample_source, binding)

    async def _async_save(self, payload):
        # Config entries also set up during boot, before HA reaches running.
        # Only shutdown states forbid persistence; first boot must save its sample.
        if self.hass.state in (CoreState.stopping, CoreState.final_write, CoreState.stopped):
            raise RuntimeUnavailable("home_assistant_stopping")
        await self._store.async_save(payload)

    async def async_start(self):
        payload, exists = await self._verified.load()
        await self.engine.start(payload, file_exists=exists)
        self.active = True
        await self.async_refresh()
        # A source can be unavailable; the UI should explain it. A failed
        # history write must stop setup instead of starting an automatic retry.
        self.engine.status()
        self._cancel_timer = async_track_time_interval(
            self.hass, self._async_tick, timedelta(minutes=30))
        self._cancel_stop = self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self._async_hass_stop)

    async def _async_hass_stop(self, _event):
        await self.async_stop()

    async def _async_tick(self, _now):
        if self.active:
            await self.async_refresh()

    async def _async_update_data(self):
        try:
            await self.engine.refresh()
            return self.engine.status()
        except RuntimeUnavailable as err:
            raise UpdateFailed(str(err)) from err

    async def async_stop(self):
        self.active = False
        if self._cancel_timer:
            self._cancel_timer()
            self._cancel_timer = None
        if self._cancel_stop:
            self._cancel_stop()
            self._cancel_stop = None
        await self.engine.stop()
