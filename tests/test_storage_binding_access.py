"""Admin read gates and source confirmation are independent of HA internals."""
import asyncio
import importlib
from types import SimpleNamespace as Obj
import unittest

from test_storage_runtime import PKG


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.m = importlib.import_module(f"{PKG}.bindings")
        self.a = dict(mountpoint="/config", root="/config", major_minor="8:1",
                      fstype="ext4", device="/dev/disk", mount_id="4", total_bytes=1000)

    def test_only_enumerated_selection_and_nonempty_sources(self):
        for selection in ([], ["/private"], ["/config", "/config"]):
            with self.assertRaises(ValueError):
                self.m.confirm_bindings([self.a], selection, [])

    def test_retain_binding_uuid_when_only_runtime_mount_id_changes(self):
        first = self.m.confirm_bindings([self.a], ["/config"], [])
        after = self.m.confirm_bindings([dict(self.a, mount_id="5")], ["/config"], first)
        self.assertEqual(first[0]["source_uuid"], after[0]["source_uuid"])
        self.assertEqual(first[0]["binding_revision"], after[0]["binding_revision"])

    def test_changed_filesystem_requires_new_explicit_binding(self):
        first = self.m.confirm_bindings([self.a], ["/config"], [])
        after = self.m.confirm_bindings([dict(self.a, device="/dev/new")], ["/config"], first)
        self.assertNotEqual(first[0]["source_uuid"], after[0]["source_uuid"])

    def test_inventory_ambiguity_is_rejected(self):
        with self.assertRaises(ValueError):
            self.m.confirm_bindings([self.a, self.a], ["/config"], [])


class AccessTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.m = importlib.import_module(f"{PKG}.access")
        self.user = Obj(id="admin", is_admin=True, is_active=True)
        self.connection = Obj(user=self.user, closed=False)
        self.lookup = self.user
        async def get_user(user_id):
            return self.lookup
        self.hass = Obj(auth=Obj(async_get_user=get_user))

    async def allowed(self):
        return await self.m.async_current_admin(self.hass, self.connection, "admin")

    async def test_active_admin_requires_fresh_auth_user(self):
        self.assertTrue(await self.allowed())
        for lookup in (None, Obj(id="admin", is_admin=False, is_active=True),
                       Obj(id="admin", is_admin=True, is_active=False),
                       Obj(id="other", is_admin=True, is_active=True)):
            self.lookup = lookup
            self.assertFalse(await self.allowed())

    async def test_replaced_or_closed_connection_denied(self):
        self.connection.user = Obj(id="other", is_admin=True, is_active=True)
        self.assertFalse(await self.allowed())
        self.connection.user = self.user
        self.connection.closed = True
        self.assertFalse(await self.allowed())

    async def test_role_loss_during_auth_await_denied(self):
        entered, release = asyncio.Event(), asyncio.Event()
        async def get_user(user_id):
            entered.set()
            await release.wait()
            return Obj(id="admin", is_admin=True, is_active=True)
        self.hass.auth.async_get_user = get_user
        task = asyncio.create_task(self.allowed())
        await entered.wait()
        self.connection.user.is_admin = False
        release.set()
        self.assertFalse(await task)

    async def test_auth_failure_is_denial(self):
        async def get_user(user_id):
            raise OSError("private failure")
        self.hass.auth.async_get_user = get_user
        self.assertFalse(await self.allowed())


if __name__ == "__main__":
    unittest.main()
