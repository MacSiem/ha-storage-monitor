"""Regression checks for untrusted Home Assistant data rendered by the card."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CARD_PATH = ROOT / "ha-storage-monitor.js"


class ReviewRequirementTests(unittest.TestCase):
    def test_runtime_values_are_escaped_at_every_reviewed_html_sink(self) -> None:
        """Reject raw HA/runtime data before it reaches an HTML template."""
        source = CARD_PATH.read_text(encoding="utf-8")

        for expression in (
            "${_esc(d.hostname)}",
            "${_esc(d.osVersion)}",
            'title="${_esc(c.name)}: ${this._fmtSize(c.size)}"',
            "_esc(c.name.split(' ')[0])",
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


if __name__ == "__main__":
    unittest.main()
