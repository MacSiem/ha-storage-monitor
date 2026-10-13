# Storage Monitor

![Preview](banner.png)

Inspect Home Assistant host disk usage and the storage sizes the Supervisor
actually exposes — backups and, on some installations, add-ons. Add the card to read Supervisor data directly. Optionally select existing
Recorder sensors to explore measured storage history for the last 7 or 30 days.

[![Version](https://img.shields.io/github/v/release/MacSiem/ha-storage-monitor)](https://github.com/MacSiem/ha-storage-monitor/releases) [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## How it works

**It reads automatically when you are an administrator and the installation
has the Supervisor.** The card needs no configuration:

1. **Disk gauge from Supervisor.** On load it calls the Supervisor API
   (`supervisor/api` → `/host/info`, `/os/info`) for total / used / free disk
   space, hostname and OS version. The usage ring is host-wide. The
   category chart includes measured sizes only and does not claim to
   account for all used disk space.
2. **Real sizes where the API provides them.** Backups get their actual size
   from `size_bytes` in `supervisor/api` → `/backups`. Add-ons get their actual size from
   `supervisor/api` → `/addons` plus a per-addon `/addons/{slug}/info` call
   (first 30 installed add-ons). Where a real size isn't available, the card
   shows `N/A` rather than inventing a value.
3. **Clear unavailable and estimated values.** The recorder database size is
   not exposed by the `recorder/info` WebSocket call in current Home
   Assistant, so the card shows `N/A` instead of inventing a value. The
   config/`www`/`.storage`/`media`/`share` values on the Files & Folders tab
   are `N/A`; this browser card cannot measure directory sizes, including
   `/backup` and `/addons`. Backup inventory can include remote locations.
   Integrations are counted via `config_entries/get`, without assigning
   imaginary byte sizes. Partial add-on and backup totals are labelled.

### What is automatic vs. manual

| Automatic | Manual (optional) |
|---|---|
| Disk gauge + category breakdown on load | Nothing required to start |
| Real backup and add-on sizes from Supervisor | Switching between the 7 tabs |
| Refresh after 2 minutes on the next HA update | Manual refresh (⟳ button) |
| Measured capacity and review prompts | Reviewing backup retention or stopped add-ons in HA |
| Current measurements and their read status | Selecting two recorded sensors and refreshing measured history |

## Screenshots

| Light | Dark |
|---|---|
| ![Overview, light theme](docs/screenshots/card-main-light.png) | ![Overview, dark theme](docs/screenshots/card-main-dark.png) |

*The installed card in Home Assistant, with the Polish interface and
synthetic test data (not real measurements). The Overview tab: gauge and measured category
breakdown. Unknown categories remain N/A instead of being treated as zero.
Dark mode follows your Home Assistant theme. Six more tabs —
Add-ons & Integrations, Backups, Files & Folders, Top Consumers, Measured history and Cleanup —
are available from the tab bar.*

## Installation

Requires Home Assistant 2025.2 or newer. Storage measurements require an
administrator account on Home Assistant OS / Supervised for Supervisor measurements.
Core / Container installations display the Supervisor requirement for those views;
Measured history can still read existing sensors when Recorder and History are enabled.

1. Open HACS and search for **Storage Monitor** (category **Dashboard**).
2. Download the card and reload your browser.
3. Add a card of type `custom:ha-storage-monitor`. In YAML mode, register
   `/hacsfiles/ha-storage-monitor/ha-storage-monitor.js` as a module resource.
   Keep exactly one Storage Monitor resource; remove an older manual duplicate.

## Quick start

```yaml
type: custom:ha-storage-monitor
```

No options are required for current Supervisor measurements.

### Optional measured history

Open the card's visual editor and select **Used sensor** and **Capacity sensor**.
Both must already exist, have the `data_size` device class and be recorded by
Recorder. Give the filesystem a clear name and confirm that both sources measure
the same filesystem. The card never guesses this relationship or creates sensors.
Changing either source or the scope clears that confirmation until you review it.

For example, replace these IDs with your own existing sensors:

```yaml
type: custom:ha-storage-monitor
measured_history:
  used_entity: sensor.disk_used
  total_entity: sensor.disk_capacity
  scope: Home Assistant data filesystem
  same_filesystem: true
```

In **Measured history**, choose 7 or 30 days and select **Refresh history**.
The range ends at the time of the request. Select a plotted point, use the
previous/next buttons or switch to **Data** to inspect the same recorded event.
Dates follow Home Assistant's time zone; details also include UTC, the source
entity, original value and unit, and exact bytes. The plot uses GiB for both space
measurements. Decimal units such as GB and binary units such as GiB are converted
separately.

A cross marks a missing value outside the value axis; zero remains a measured
zero. Capacity changes have a Δ marker. Events are not connected or interpolated,
and the card makes no forecast. Recorder coverage and retention remain unknown:
a successful read does not prove a complete 7- or 30-day history. Requests are
split into daily intervals; client inspection stops at 12,000 records or 2,400
events and labels the result partial. Data pages show 50 events at a time.

### Refresh results

The result remains visible after refreshing. **Success** means the supported
sources were read; unsupported size measurements remain `N/A`. **Partial** means
some requested data is missing or malformed. **No data** means no measurements
were returned or Supervisor is unavailable. **Error** reports a failed read without
showing private server details. **Not checked** is shown while a read is pending.
After a connection or account change, refresh explicitly to obtain a current
result. Cleanup suggestions are advisory and never delete backups or files.

### Optional sidebar panel (`configuration.yaml`)

```yaml
panel_custom:
  - name: ha-storage-monitor
    sidebar_title: Storage Monitor
    sidebar_icon: mdi:harddisk
    url_path: ha-storage-monitor
    js_url: /local/community/ha-storage-monitor/ha-storage-monitor.js
    embed_iframe: false
    config: {}
```

After restart, **Storage Monitor** appears in the HA sidebar.

## Features

- **Overview** — host disk usage ring, measured category chart and per-category
  size/`N/A` list (Backups, Database, Add-ons, Integrations, System & Other).
- **Add-ons & Integrations** — every installed add-on with available measured
  size/status/version, and config entries with their setup source and status. Setup source
  does not identify Core versus HACS provenance; storage remains N/A.
- **Backups** — each backup with measured `size_bytes` when available, date
  and type from Supervisor.
- **Files & Folders** — known paths with `N/A` because this card does not
  measure directories: `/config`, `/config/www`,
  `/config/custom_components`, `/config/.storage`, `/backup`, `/addons`,
  `/ssl`, `/media`, `/share`, sortable by size or name.
- **Top Consumers** — the 10 largest items ranked across backups, add-ons
  (real sizes only) and the recorder database.
- **Measured history** — recorded used space and capacity over 7 or 30 days,
  interactive Chart/Data views, exact source details and marked gaps/capacity changes.
- **Cleanup** — measured capacity warning and prompts to review backup
  retention or stopped add-ons; no deletion is performed.

## FAQ

**Do I have to configure anything?**
Current Supervisor measurements need no configuration. Measured history is optional: select two existing recorded sensors for the same filesystem in the visual editor.

**Why does it say "Requires Home Assistant OS / Supervised"?**
The card needs the Supervisor API (`supervisor/api`) for disk, add-on and
backup data. This is only available on Home Assistant OS or Home Assistant
Supervised installations — Home Assistant Container/Core setups don't expose
it. The Supervisor views show this notice; Measured history remains available
with configured Recorder sources.

**Are the sizes exact?**
Backup and add-on sizes come from the Supervisor API when it provides an
unambiguous measurement. Missing values show `N/A`, and incomplete totals
are labelled partial. The recorder
database size is shown as `N/A` because Home Assistant's current
`recorder/info` response does not expose it. The Files & Folders tab is a
path inventory, not a filesystem scan; host disk usage cannot be allocated
to these categories reliably from the available API data.

**Does this send data anywhere?**
No. Everything runs locally in your browser against your own Home Assistant
instance — no telemetry, no analytics, no CDN-hosted assets. The only
outbound links are the optional Buy Me a Coffee / PayPal buttons and GitHub
install links, which only open if you click them.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Support

If this tool makes your Home Assistant life easier, consider supporting
development:

- [☕ Buy Me a Coffee](https://buymeacoffee.com/macsiem)
- [💳 PayPal](https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W)

The optional in-card support link is shown only to administrators. Dismiss it in the card or set `show_support: false` in the card configuration.

## License

MIT, see [LICENSE](LICENSE).

## Privacy and data

The card reads available Home Assistant and Supervisor storage information and, when configured, Recorder history for the two selected sensors. Host details, integration lists and backup metadata can identify your installation. Keep diagnostics private and redact host names, paths and identifiers before sharing.

See [SECURITY.md](SECURITY.md) for safe vulnerability reporting and [NOTICE](NOTICE) for licensing notices.
