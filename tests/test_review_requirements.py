"""Regression checks for untrusted Home Assistant data rendered by the card."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CARD_PATH = ROOT / "ha-storage-monitor.js"


class ReviewRequirementTests(unittest.TestCase):
    def test_narrow_sections_use_the_card_width_and_never_overflow(self) -> None:
        """HA Sections can be narrow while the browser viewport stays wide."""
        source = CARD_PATH.read_text(encoding="utf-8")

        for required in (
            "container-type: inline-size",
            "@container (max-width: 420px)",
            ".gauge-info { flex: 1; min-width: 0; width: 100%; }",
            "overflow-wrap: anywhere",
        ):
            with self.subTest(required=required):
                self.assertIn(required, source)

    def test_public_screenshot_fixture_has_no_owner_identifier(self) -> None:
        harness = (ROOT / "docs/screenshots/_harness.html").read_text(encoding="utf-8")
        self.assertNotIn("Mac" + "iej", harness)

    def test_runtime_values_are_escaped_at_every_reviewed_html_sink(self) -> None:
        """Reject raw HA/runtime data before it reaches an HTML template."""
        source = CARD_PATH.read_text(encoding="utf-8")

        for expression in (
            "${_esc(d.hostname)}",
            "${_esc(d.osVersion)}",
            'title="${_esc(c.name)}: ${this._fmtSize(c.size)}"',
            "_esc(String(c.name ?? '').split(' ')[0])",
            "${_esc(c.name)}${c.items ? ` (${c.items.length})` : ''}",
            "${_esc(i.title || i.domain)}",
            "${_esc(i.domain)}",
            "${_esc(i.state || 'unknown')}",
            "${_esc(i.source || 'user')}",
            "${_esc(b.type || 'full')}",
            "${_esc(s.desc)}",
            'title="' + "' + _esc(item.name) + '" + '">' + "' + _esc(item.name) + '" + "</div>'",
        ):
            with self.subTest(expression=expression):
                self.assertIn(expression, source)

    def test_document_wide_cross_card_injector_is_absent(self) -> None:
        """The card must never scan or mutate unrelated frontend shadow roots."""
        source = CARD_PATH.read_text(encoding="utf-8")

        for forbidden in (
            "SPLIT_TAGS",
            "deepFindAll",
            "injectInto",
            "injectAll",
            "__haToolsSplitDonateInjector",
            "window._haToolsEsc",
            "observe(document.body",
            "querySelectorAll('*')",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, source)

        self.assertIn("${STORAGE_MONITOR_DONATE_HTML}", source)
        self.assertIn("const _esc = ((s) => String(s == null ? '' : s)", source)
        self.assertNotIn("typeof s === 'string' ? s.replace", source)

    def test_missing_measurements_are_not_replaced_with_fake_values(self) -> None:
        source = CARD_PATH.read_text(encoding="utf-8")

        for forbidden in (
            "|| 32",
            "|| 10",
            "let sizeMB = 0.5",
            "Math.min(systemMB * 0.2, 2048)",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, source)

        self.assertIn("localStorage.getItem('ha-storage-monitor-settings')", source)
        self.assertIn("localStorage.setItem('ha-storage-monitor-' + k", source)


if __name__ == "__main__":
    unittest.main()
