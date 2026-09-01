# Changelog — Storage Monitor

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
