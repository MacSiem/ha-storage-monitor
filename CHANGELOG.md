# Changelog — Storage Monitor

## 4.1.16 (2026-10-06)

- Preserve loaded content after configuration edits and restore the selected tab after reload, including invalid-state recovery and accessible selection.
- Clear cached storage data when administrator authority or account changes, and cancel stale work when the card detaches. Recheck authority and load fresh data when Home Assistant reconnects the existing card after dashboard editing.
- Distinguish missing Supervisor, permission denial and temporary connection failures; unavailable inventories never appear empty.
- Show measured values, explicit zero, N/A and partial totals honestly. Backup and add-on totals are not presented as directory measurements, and free disk space is never inferred.
- Show the Home Assistant / Supervisor source and time of the last successful read. Use the supported config-entry API without guessing Core/HACS provenance or entry source.
- Translate tabs, data labels, cleanup guidance, support and editor title into Polish or English using the Home Assistant language, while retaining the selected tab and sorting.
- Keep support administrator-only and preserve dismissal for the card session when browser storage cannot save it.
- Avoid duplicate initial reads. Cleanup remains advisory and never deletes data.
- Correct HACS discovery, resource registration and measurement limitations in the installation guide.

## 4.1.15 (2026-09-01)

- Removed the fixed six-row Sections allocation so the card's grid boundary follows its dynamic tab content height.
- Added a regression check that prevents a fixed row constraint from reintroducing cross-card overlap.

## 4.1.14 (2026-09-01)

- Fixed the Overview gauge overflowing narrow Home Assistant Sections while the browser viewport remains wide.
- Responsive rules now follow the card's own container width; long host and OS values wrap inside the card instead of crossing its boundary.
- Removed the remaining owner identifier from the public screenshot fixture and aligned README wording with unavailable add-on measurements.
- Tiny but valid measured add-ons now remain eligible for Top Consumers, while partial add-on totals are labelled as partial instead of estimated.

## 4.1.13 (2026-08-28)

- Isolation: Bento CSS is component-local and cannot be captured from `window.HAToolsBentoCSS` by load order.
- Isolation: persistence is now card-local, removing `window._haToolsPersistence` load-order coupling while retaining existing localStorage keys.
- Removed the document-wide sibling-card injector and its global observers/timers; the donate section now stays inside Storage Monitor's own card shadow root.
- Recorder and missing Supervisor disk values no longer use fabricated fallback sizes; unavailable measurements render as N/A and estimates are labelled.
- Fixed the 30-second render throttle and aligned persisted settings with the `ha-storage-monitor-` namespace.

## 4.1.12 (2026-08-21)

- Security: escape Supervisor and Home Assistant runtime values at every card HTML sink, including host/OS metadata, categories, integrations, backups, Top Consumers, and cleanup descriptions.

## 4.1.11 (2026-07-18)

- Fix (UI): the small accent dot before section titles no longer detaches from the title text (it was pushed to the opposite edge by the header's flex space-between); it is now pinned next to the title.

## [4.1.8] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [4.1.7] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [4.1.6] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [4.1.3] - 2026-05-12

### Fixed
- Removed Google Fonts CDN @import (1 occurrence(s)); now uses system font stack with Inter as the preferred locally-installed face.
- Normalized bare `font-family: "Inter", sans-serif` declarations to a complete cross-platform system stack.
- Privacy section in README: claim now matches behaviour (no CDN dependencies).

All notable changes to **Storage Monitor** are documented here.

## [4.0.0] - 2026-05-10

### Major
- **Split from `MacSiem/ha-tools` monorepo** into a dedicated standalone HACS plugin.
- Bundled Bento Design System CSS inline — no shared dependency required.
- Inlined `_haToolsEsc` XSS sanitizer.
- Persistence keys migrated to per-tool namespace `ha-storage-monitor-…` (clean break — old data under `ha-tools-…` is **not** migrated automatically).
- Donation/support footer added to the panel.
- Cross-tool discovery banner removed; each tool stands on its own.

### Compatibility

- Home Assistant ≥ 2024.1.0
## Unreleased — storage truthfulness

- Remove arbitrary folder and integration size estimates and the double-counted "System & Other" residual. The category chart now covers measured sizes only; unknown sizes display `N/A`.
- Use only Supervisor `size_bytes` for backup bytes, label partial totals, and replace count-only backup deletion advice with a retention review prompt.
