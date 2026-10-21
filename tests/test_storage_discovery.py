"""System Monitor association uses registry identity, never display names."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import SimpleNamespace as Entry
import re
import unittest


def slug(value):
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).resolve().parents[1] / "custom_components/ha_storage_monitor/discovery.py"
        spec = spec_from_file_location("storage_discovery", path)
        self.m = module_from_spec(spec)
        spec.loader.exec_module(self.m)

    def entry(self, key="disk_use", mount="/config", **extra):
        return Entry(**({"entity_id": "sensor.renamed", "platform": "systemmonitor",
                         "config_entry_id": "sm", "unique_id": slug(f"{key}_{mount}"),
                         "disabled_by": None} | extra))

    def associate(self, entries, mounts=("/config",)):
        return self.m.associate_system_monitor(mounts, entries, {"sm"}, slug)

    def test_renamed_valid_registry_matches_no_total_invented(self):
        result = self.associate([self.entry(), self.entry("disk_free", entity_id="sensor.free")])
        self.assertEqual(result["/config"]["entity_ids"],
                         {"used": "sensor.renamed", "free": "sensor.free"})
        self.assertNotIn("total", result["/config"]["entity_ids"])

    def test_disabled_sensor_retained_as_disabled_no_enable(self):
        entry = self.entry(disabled_by="integration")
        result = self.associate([entry])["/config"]
        self.assertEqual(result["entity_ids"], {})
        self.assertEqual(result["disabled_entity_ids"], {"used": "sensor.renamed"})
        self.assertEqual(entry.disabled_by, "integration")

    def test_foreign_integration_or_entry_or_domain_never_matches(self):
        for extra in ({"platform": "template"}, {"config_entry_id": "foreign"},
                      {"entity_id": "switch.not_sensor"}):
            with self.subTest(extra=extra):
                self.assertEqual(self.associate([self.entry(**extra)])["/config"]["entity_ids"], {})

    def test_slug_collision_never_guesses(self):
        result = self.associate([self.entry(mount="/a-b")], ("/a-b", "/a_b"))
        self.assertEqual(result["/a-b"]["reason"], "ambiguous_registry_identity")
        self.assertEqual(result["/a_b"]["entity_ids"], {})

    def test_duplicate_registry_identity_never_guesses(self):
        result = self.associate([self.entry(), self.entry(entity_id="sensor.other")])
        self.assertEqual(result["/config"]["entity_ids"], {})
        self.assertEqual(result["/config"]["reason"], "ambiguous_registry_identity")

    def test_missing_system_monitor_is_empty_not_fake_entity(self):
        self.assertEqual(self.associate([])["/config"],
                         {"entity_ids": {}, "disabled_entity_ids": {}, "reason": "no_matching_entities"})

    def test_percent_sensor_is_its_own_identity(self):
        result = self.associate([self.entry("disk_use_percent", entity_id="sensor.percent")])
        self.assertEqual(result["/config"]["entity_ids"], {"percent": "sensor.percent"})


if __name__ == "__main__":
    unittest.main()
