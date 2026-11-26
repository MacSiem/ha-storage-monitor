"""Resource migration leaves foreign resources untouched and fences unload races."""
import asyncio
import importlib
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


class MigrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.urls = set()
        frontend = types.ModuleType('homeassistant.components.frontend')
        frontend.DATA_EXTRA_MODULE_URL = 'extra'
        frontend.DATA_PANELS = 'panels'
        frontend.add_extra_js_url = lambda hass, url: self.urls.add(url)
        frontend.remove_extra_js_url = lambda hass, url: self.urls.remove(url)
        frontend.async_remove_panel = lambda *args, **kwargs: None
        components = types.ModuleType('homeassistant.components')
        components.frontend = frontend
        components.panel_custom = types.ModuleType('homeassistant.components.panel_custom')
        http = types.ModuleType('homeassistant.components.http')
        http.StaticPathConfig = object
        ha = types.ModuleType('homeassistant')
        package = types.ModuleType('migration_test')
        package.__path__ = [str(Path(__file__).resolve().parents[1] / 'custom_components/ha_storage_monitor')]
        modules = {'homeassistant': ha, 'homeassistant.components': components,
                   'homeassistant.components.frontend': frontend,
                   'homeassistant.components.panel_custom': components.panel_custom,
                   'homeassistant.components.http': http, 'migration_test': package}
        self.patcher = patch.dict(sys.modules, modules)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.addCleanup(lambda: [sys.modules.pop(k, None) for k in
                                 ('migration_test.frontend', 'migration_test.const')])
        self.m = importlib.import_module('migration_test.frontend')
        self.items = []
        self.resources = types.SimpleNamespace(loaded=True, async_items=lambda: list(self.items))
        self.hass = types.SimpleNamespace(data={'lovelace': {'resources': self.resources}, 'extra': self.urls})
        self.receipt = {'extra_url': None, 'panel': None, 'panel_snapshot': None,
                        'lock': asyncio.Lock(), 'closed': False}

    async def test_guided_migration_is_idempotent_and_preserves_foreign_resource(self):
        old = {'id': 'old', 'url': '/hacsfiles/ha-storage-monitor/ha-storage-monitor.js?v=4', 'type': 'module'}
        self.items.append(old.copy())
        self.assertEqual(await self.m.async_reconcile_card(self.hass, self.receipt), 'migration_required')
        self.assertEqual(self.items, [old])
        self.assertFalse(self.urls)
        self.items.clear()  # Administrator removes it, outside integration code.
        self.assertEqual(await self.m.async_reconcile_card(self.hass, self.receipt), 'registered')
        self.assertEqual(await self.m.async_reconcile_card(self.hass, self.receipt), 'registered')
        self.assertEqual(len(self.urls), 1)
        await self.m.async_unregister(self.hass, self.receipt)
        self.assertFalse(self.urls)
        self.assertEqual(await self.m.async_reconcile_card(self.hass, self.receipt), 'unavailable')

    async def test_yaml_or_missing_resources_never_inject(self):
        for lovelace in ({'mode': 'yaml', 'resources': self.resources}, None):
            self.hass.data['lovelace'] = lovelace
            self.assertEqual(await self.m.async_reconcile_card(self.hass, self.receipt), 'manual_required')
            self.assertFalse(self.urls)

    async def test_manual_integration_resource_is_not_adopted(self):
        item = {'id': 'manual', 'url': '/ha-storage-monitor-assets/ha-storage-monitor.js?v=5.3.0',
                'type': 'module'}
        self.items.append(item.copy())
        self.assertEqual(await self.m.async_reconcile_card(self.hass, self.receipt), 'existing_resource')
        await self.m.async_unregister(self.hass, self.receipt)
        self.assertEqual(self.items, [item])
        self.assertFalse(self.urls)

    async def test_unload_fences_inflight_resource_load(self):
        started, resume = asyncio.Event(), asyncio.Event()
        async def load():
            started.set()
            await resume.wait()
        self.resources.loaded = False
        self.resources.async_load = load
        pending = asyncio.create_task(self.m.async_reconcile_card(self.hass, self.receipt))
        await started.wait()
        cleanup = asyncio.create_task(self.m.async_unregister(self.hass, self.receipt))
        await asyncio.sleep(0)
        resume.set()
        self.assertEqual(await pending, 'unavailable')
        await cleanup
        self.assertFalse(self.urls)

    async def test_foreign_arrives_after_registration_only_owned_extra_removed(self):
        await self.m.async_reconcile_card(self.hass, self.receipt)
        foreign = {'id': 'manual', 'url': '/local/ha-storage-monitor.js', 'type': 'module'}
        self.items.append(foreign)
        self.assertEqual(await self.m.async_reconcile_card(self.hass, self.receipt), 'migration_required')
        self.assertEqual(self.items, [foreign])
        self.assertFalse(self.urls)


if __name__ == '__main__':
    unittest.main()
