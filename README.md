# Storage Monitor

![Preview](banner.png)

Inspect Home Assistant host disk usage and the storage sizes the Supervisor
actually exposes, including backups. Add the card to read Supervisor data directly. Optionally select existing
Recorder sensors to explore measured storage history for the last 7 or 30 days.

[![Version](https://img.shields.io/github/v/release/MacSiem/ha-storage-monitor)](https://github.com/MacSiem/ha-storage-monitor/releases) [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## How it works

**It reads automatically when you are an administrator and the installation
has the Supervisor.** The card needs no configuration:

1. **Disk gauge from Supervisor.** On load it calls the Supervisor API
   (`supervisor/api` → `/host/info`, `/os/info`) for total / used / free disk
   space in GiB, hostname and OS version. The usage ring covers the Supervisor data filesystem. The
   category chart includes measured sizes only and does not claim to
   account for all used disk space.
2. **Real sizes where the API provides them.** Backups get their actual size
   from `size_bytes` in `supervisor/api` → `/backups`. The card reads `/addons` and up to 30 per-addon info responses; the current
   Supervisor info schema does not provide add-on disk usage, so these sizes
   show `N/A`. If a compatible response supplies `disk_usage` in bytes, the
   card can display it without estimating.
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
| Backup sizes when exposed by Supervisor | Switching between five tabs and the explicit cleanup review action |
| Refresh after 2 minutes on the next HA update | Manual refresh (⟳ button) |
| Measured capacity and review prompts | Reviewing backup retention or stopped add-ons in HA |
| Current measurements and their read status | Selecting two recorded sensors and refreshing measured history |

## Screenshots

| Light | Dark |
|---|---|
| ![Overview, light theme](docs/screenshots/card-main-light.png) | ![Overview, dark theme](docs/screenshots/card-main-dark.png) |

| Recorded history, light | Recorded history, dark |
|---|---|
| ![Measured history, light theme](docs/screenshots/card-history-light.png) | ![Measured history, dark theme](docs/screenshots/card-history-dark.png) |

*Version 4.2.0 rendered in Chrome with synthetic Supervisor and Recorder data.
The history example includes a missing measurement, a measured zero, a capacity
change and distinct GB/GiB units. These historical screenshots retain the old N/A category labels and seven-tab layout.
They do not show the variants, five-tab navigation or the current Not measured labels.*

## Dashboard transition

Dashboard 4.2.1 announced the move to Integration. Keep using that release until
an Integration release is available in HACS, then follow the migration steps below.
The transition preserves your existing cards and settings. The notice in 4.2.1
can be dismissed by an administrator.

Dashboard 4.2.1 zapowiedział przejście do Integration. Korzystaj z tego wydania
do czasu udostępnienia Integration w HACS, a następnie wykonaj poniższe kroki.
Migracja zachowuje istniejące karty i ustawienia. Administrator może ukryć
komunikat w wersji 4.2.1.

## Installation

Requires Home Assistant 2025.2 or newer. Storage measurements require an
administrator account on Home Assistant OS / Supervised for Supervisor measurements.
Core / Container installations can show current capacity from an explicitly selected
used/capacity sensor pair. Supervisor categories remain unavailable for that filesystem.
Measured history also requires Recorder and History to be enabled.

Once the Integration release is available in HACS, install **Storage Monitor**
from **Integrations**, restart HA and add it in Settings → Devices & services.
Select the filesystems visible to HA. For a new storage-mode dashboard, reload
the browser and add `custom:ha-storage-monitor`. The optional panel and native
forecast sensor can be selected during setup. The sensor follows normal HA entity
permissions and may be visible to household users.

### Moving from Dashboard to Integration

Back up HA and your dashboard configuration first. Install and configure the
Integration, then open Settings → System → Repairs and select **Migrate the
Storage Monitor dashboard resource**. In Settings → Dashboards → Resources remove only your own old Storage Monitor
Dashboard or manual module. Keep your dashboard cards, variants
and settings. Submit the repair, refresh the browser and verify the cards. The
integration does not remove or overwrite existing resources. If another copy
remains, identify it before removing it and retry the repair.

For YAML-managed resources, replace only the old Storage Monitor resource with
`/ha-storage-monitor-assets/ha-storage-monitor.js?v=5.3.0` as `type: module`,
restart HA and refresh the browser. Keep all other resources. Without Repairs,
the same URL can be added in the Resources UI after removing the old copy.
Never load both copies simultaneously; they define the same card element.

To roll back, remove the Integration and its resource (including a manually
added module), restore Dashboard 4.2.1 in HACS and its original
resource, then refresh and verify the existing cards. Restore the dashboard
backup only if needed; migration does not edit dashboard configuration.

### Migracja z Dashboard do Integration

Przed zmianą zapisz kopię HA i konfiguracji pulpitów. Po udostępnieniu wydania
Integration w HACS zainstaluj je, uruchom HA ponownie i dodaj integrację w
Ustawienia → Urządzenia oraz usługi. W Ustawienia → System → Naprawy wybierz
**Przenieś zasób karty Storage Monitor**. W Ustawienia → Pulpity → Zasoby usuń wyłącznie własny stary moduł Dashboard
lub z instalacji ręcznej. Zachowaj karty, warianty i ustawienia. Zatwierdź naprawę,
odśwież przeglądarkę i sprawdź karty. Integracja nie przejmuje ani nie usuwa
cudzych zasobów; jeśli inna kopia pozostała, ustal jej pochodzenie przed usunięciem.

W YAML zastąp tylko stary zasób Storage Monitor adresem
`/ha-storage-monitor-assets/ha-storage-monitor.js?v=5.3.0` i `type: module`,
uruchom HA ponownie i odśwież przeglądarkę. Bez Napraw można dodać ten adres w
Zasobach po usunięciu starej kopii. Nie ładuj obu kopii jednocześnie.
Powrót: usuń integrację oraz jej zasób (również ręczny), przywróć wydanie
Dashboard 4.2.1 w HACS i jego zasób, odśwież przeglądarkę i sprawdź karty.
Migracja nie zmienia konfiguracji pulpitów; kopię przywróć tylko w razie potrzeby.

## Quick start

```yaml
type: custom:ha-storage-monitor
```

No options are required for current Supervisor measurements.

### Optional filesystem sensors and measured history

Open the card's visual editor and select **Used sensor** and **Capacity sensor**.
Both must already exist and have the `data_size` device class. Recorder must
record them to show measured history. Give the filesystem a clear name and confirm that both sources measure
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

The same confirmed pair supplies current capacity in **Overview** directly from HA
states, including on Core / Container. This explicitly selects that filesystem:
unavailable or invalid values show no data and never fall back to the Supervisor host.
Current capacity does not require a history refresh or Recorder. Values are normalized
to decimal GB; **Free (calculated)** is capacity minus used space. Source IDs, scope
and source timestamps are shown. Supervisor categories are unavailable for this scope;
the card does not attribute disk usage to backups or add-ons on another filesystem.
The administrator requirement remains. Without a selected pair, the default is Supervisor.

If the integration is installed, the editor can also find System Monitor sensor
pairs per filesystem. Review a unique active **used / free** pair and explicitly
confirm it before applying it. Existing manual sensor choices are never replaced.
An explicit integration selection is retained; switch to **Existing sensors / Supervisor**
before applying a suggested pair.
This fallback displays the two measured values; total capacity, percentage and
Recorder history remain unavailable. Missing, disabled or ambiguous pairs are not
suggested. A missing or unavailable selected sensor does not switch filesystems.

In **Measured history**, choose 7 or 30 days and select **Refresh history**.
The range ends at the time of the request. Select a plotted point, use the
previous/next buttons or switch to **Data** to inspect the same recorded event.
Dates follow Home Assistant profile preferences, including its display time zone; details also include UTC, the source
entity, original value and unit, and exact bytes. The plot uses GiB for both space
measurements. Decimal units such as GB and binary units such as GiB are converted
separately.

A cross marks a missing value outside the value axis; zero remains a measured
zero. Capacity changes have a Δ marker. Grey intervals indicate unknown continuity.
Recorder events are not connected or interpolated; a recorded state does not prove
continuous measurement. The card makes no fill-date forecast. Recorder coverage and retention remain unknown:
a successful read does not prove a complete 7- or 30-day history. Requests are
split into daily intervals; client inspection stops at 12,000 records or 2,400
events and labels the result partial. Data pages show 50 events at a time.

### Refresh results

The result remains visible after refreshing. **Success** means the supported
Supervisor sources were read; unsupported size measurements remain unavailable.
For history and the small variants, **Partial** also makes unknown measurement
coverage explicit even after a successful request. **No data** means no measurements
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
  size/`Not measured` list (Backups, Database, Add-ons, Integrations, System & Other).
- **Add-ons & Integrations** — every installed add-on with available measured
  size/status/version, and config entries with their setup source and status. Setup source
  does not identify Core versus HACS provenance; storage remains N/A.
- **Backups** — each backup with measured `size_bytes` when available, date
  and type from Supervisor.
- **Resources and folders**: known paths with `N/A` because this card does not
  measure directories: `/config`, `/config/www`,
  `/config/custom_components`, `/config/.storage`, `/backup`, `/addons`,
  `/ssl`, `/media`, `/share`, sortable by size or name.
  Its **Largest measured resources** disclosure contains the former Top Consumers
  ranking of up to 10 positive measured items. Supervisor categories are a separate
  scope and do not form a complete breakdown of the selected filesystem.
- **Measured history** — recorded used space and capacity over 7 or 30 days,
  interactive Chart/Data views, exact source details and marked gaps/capacity changes.
- **Review cleanup options** is an explicit action above the tabs. It opens measured
  capacity warnings and prompts to review backup retention or stopped add-ons.
  The suggestions do not delete anything. Saved `cleanup` navigation never opens
  the action automatically.

## FAQ

**Do I have to configure anything?**
Current Supervisor measurements need no configuration. Optionally select two existing sensors for the same filesystem in the visual editor to use that filesystem for current capacity; Recorder enables measured history for those sensors.

**Why does it say "Requires Home Assistant OS / Supervised"?**
Without a selected sensor pair, the card needs the Supervisor API (`supervisor/api`)
for current disk, add-on and backup data. This is only available on Home Assistant OS or Home Assistant
Supervised installations — Home Assistant Container/Core setups don't expose
it. The Supervisor views show this notice; Measured history remains available
with configured Recorder sources.

**Are the sizes exact?**
Backup sizes come from `size_bytes` when available. Current Supervisor add-on
info does not expose disk usage; the card retains support for a compatible
`disk_usage` byte value if supplied. Missing values show `N/A`, and incomplete totals
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

## Variants, history and comparison

| Setting | Values | Behavior |
|---|---|---|
| `variant` | `tile`, `compact`, `full` | Missing or unrecognized values render Full. The card picker creates Compact. |
| `default_tab` | `overview`, `addons`, `backups`, `files`, `trend` | An explicit value selects the initial Full tab. Otherwise the saved tab or Overview is used. |
| Legacy `top` | Saved key or `default_tab` | Opens Resources and folders with the measured ranking expanded. |
| Legacy `cleanup` | Saved key or `default_tab` | Opens Overview with a notice about the cleanup review action. It performs no cleanup. |

`default_tab` applies when a card is created or that setting changes. Title edits
preserve current navigation. Reading a saved tab performs no migration write.
Navigation writes preserve unrelated saved fields.

Tile uses six section columns and one row. Compact has a small capacity summary
and at most two actions: Open full view and Refresh. Both share the selected
filesystem, snapshot, original source times and administrator policy with Full.
An invalid or unavailable pair never falls back to another disk.

Open full view uses the product-owned `ha-storage-monitor-full-view` element.
It receives current `hass`, shares the current snapshot and returns focus when
closed. Account, authority, instance, connection or online-session changes close
the view and invalidate pending history. Opening Full does not request Recorder
automatically. No variant creates sensors or changes dashboards.

Example for a new card, using existing sensors:

```yaml
type: custom:ha-storage-monitor
variant: compact
default_tab: trend
measured_history:
  used_entity: sensor.disk_used
  total_entity: sensor.disk_capacity
  scope: Home Assistant data filesystem
  same_filesystem: true
```

### What the measured change means

The 7/30-day selector defines the requested window ending at request time. The
delta uses the latest comparable sequence in the returned records, with at least
three pairs. Each pair requires used and capacity at exactly the same Recorder
timestamp. The confirmed filesystem and scope, source IDs and metadata, per-source
units, capacity and chronological order must remain comparable.

An old capacity is not carried forward to pair asynchronous used measurements.
Unknown, unavailable, changed capacity/source/units and conflicting timestamps
split the sequence. Attribute-only updates marked by an older `lc` are not counted
as new measurements. Incorrect input time order or malformed records suppress
comparison. GB and GiB remain distinct and are converted to bytes. A measured
zero change is possible; missing data is never a zero change.

The delta is last used bytes minus first used bytes. Actual endpoint dates, raw
bytes and the count of pairs remain available. The UI always labels this as an
available fragment, not a complete measurement of seven or thirty days.
The delta describes endpoint values, not continuity or a fill-date forecast.

### Why grey intervals can remain instead of steps

The existing `history/history_during_period` contract returns state updates.
Its `lu` is `last_updated`; it does not certify continuous physical sampling.
Even repeated equal values do not prove interval coverage. The adapter therefore
returns real points and unknown intervals, including before the first and after
the last point. No arbitrary gap duration or 100% coverage is assumed.

The segmented step renderer accepts explicitly confirmed measurement intervals,
but this Recorder adapter never manufactures that evidence. A producer with a
documented interval validity and filesystem identity contract is required before
continuous steps can be enabled. There is no YAML override pretending to provide
that evidence.

Sources: [Home Assistant state object](https://www.home-assistant.io/docs/configuration/state_object/),
[history WebSocket implementation](https://github.com/home-assistant/core/blob/dev/homeassistant/components/history/websocket_api.py)
and [state_reported announcement](https://developers.home-assistant.io/blog/2024/03/20/state_reported_timestamp/).
These explain source semantics and do not constitute native QA.

### Kategorie, warianty i historia po polsku

Kategorie z nieznanym rozmiarem mają opis „Nie zmierzono”. Przy mniej niż dwóch
dodatnich zmierzonych kategoriach widoczna jest lista danych. Zero i nieznane
kategorie pozostają widoczne. Inwentarz obliczony z bajtów używa MiB lub GiB.
Pomiary encji są pokazywane w dziesiętnych GB, a pomiar Supervisor w GiB.

Edytor integracji może zaproponować jednoznaczną aktywną parę zajęte / wolne z System Monitor dla danego filesystemu. Zastosowanie wymaga jawnego potwierdzenia; istniejące ręczne mapowanie ma pierwszeństwo. Para pokazuje oba pomiary, bez wyliczania pojemności, procentu ani historii. Brak, wyłączenie lub kolizja pozostają nieznane.

Stary YAML bez `variant` zachowuje Full. Nowy picker daje Compact. Tile i Compact
pokazują wybrany dysk, zajętość, wolne miejsce i jakość źródła. Wolne obliczone
z pary encji nie jest trzecim pomiarem. Kategorie Supervisor mają inny zakres
i nie tworzą pełnego bilansu tego filesystemu. Błędna para nie przełącza dysku.

Zakładki to Przegląd, Dodatki i integracje, Kopie zapasowe, Zasoby i katalogi
oraz Zmierzona historia. Zapisane `top` rozwija ranking zasobów. Zapisane `cleanup`
pokazuje Przegląd i informację o jawnej akcji porządkowania. Odczyt zakładki nie
uruchamia tej akcji. Select zastępuje zakładki wyłącznie przy zmierzonej dostępnej
szerokości poniżej 280 px.

Zmiana w zakresie 7 lub 30 dni wymaga co najmniej trzech porównywalnych par użycia
i pojemności o dokładnie zgodnych czasach. Obowiązują ten sam potwierdzony
filesystem, zakres, źródła, metadane, jednostki, pojemność i kolejność czasu.
Starej pojemności nie przypisujemy nowemu użyciu. Unknown, unavailable i zmiany
źródeł dzielą sekwencję. Widoczne są faktyczne daty, liczba par i surowe bajty.
Dostępny fragment nie jest pełnym pomiarem 7 lub 30 dni; brak danych nie jest zerem.

Recorder nie potwierdza pomiarów między zapisami. Szare odcinki pozostają nieznane,
a punkty nie są łączone bez potwierdzenia ciągłości. Nie ma arbitralnego progu
luki, interpolacji, ekstrapolacji, procentu kompletności ani prognozy zapełnienia.
Aktualizacje samych atrybutów z jawnym starszym `lc` nie liczą się jako nowe pomiary.
Szczegóły zachowują UTC i strefę. Zwykły widok używa krótkich lokalnych dat i godzin
zgodnych z profilem Home Assistant.

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
