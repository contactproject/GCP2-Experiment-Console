# Contact Project — GCP2 Experiment Console

**Version 0.4.2**

A Chrome Manifest V3 extension for monitoring the public GCP2 Live Data feed, recording node-level Device Coherence alongside Global Network Variance, and marking prospective experiment windows with timestamped START / EVENT / END annotations.

> **Status:** experimental research tool.  
> **Scope:** this extension records GCP2-derived live statistics. It does **not** expose the raw bitstream from the physical RNG channels.

## What it does

The console is injected into the GCP2 Live Data page and provides a compact, wide experiment workspace with:

- multi-node selection from the current live device feed;
- node **Device Coherence (`ac`)** capture;
- simultaneous **Global Network Variance (`netvar`)** capture;
- approximately 35-second polling;
- LIVE / STALE health indication;
- current local time;
- an experiment timer;
- timestamped **START / EVENT / END** markers;
- a per-node intention / experiment notepad;
- a dual-scale chart with 1 h / 6 h / 24 h / All ranges;
- visible gaps when collection is interrupted for more than 90 seconds;
- GCP2 coherence-level color indication;
- JSONL and CSV export;
- complete database backup and merge-style restore;
- persistent browser storage using IndexedDB.

The default / historical node is **58114 — ContactProject.Org**, but v0.4.2 can monitor any numeric node present in the current GCP2 live feed.

## Screenshot

For a public repository, use a cropped screenshot showing only the extension and the GCP2 map. Avoid screenshots that expose browser tabs, email addresses, account names, or unrelated personal information.

Suggested path:

```text
docs/images/gcp2-console-v4.2.png
```

Then add:

```markdown
![GCP2 Experiment Console v0.4.2](docs/images/gcp2-console-v4.2.png)
```

## Installation

This extension is currently installed as an **unpacked Chrome extension**.

1. Download or clone the repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder that directly contains:
   - `manifest.json`
   - `background.js`
   - `main.js`
6. Open or reload the GCP2 Live Data page:
   `https://gcp2.net/data-results/live-data`
7. Wait for the live map to populate.
8. Click the extension icon.

After updating from an older version, reload the GCP2 Live Data tab once before launching the new build.

## Permissions

The manifest requests only:

```json
"permissions": ["activeTab", "scripting"],
"host_permissions": ["https://gcp2.net/*"]
```

`activeTab` and `scripting` are used to inject `main.js` into the currently active GCP2 page. The extension is scoped to `https://gcp2.net/*`.

The collector stores research data in the browser under the GCP2 page origin using **IndexedDB** and `localStorage`.

## Live data path

The collector obtains the bearer token used by the GCP2 page from:

```text
/js/data/api_token.js
```

It then polls:

```text
/api/getgeogroupac
/api/getcurrentnetvar
```

The first endpoint provides the live device GeoJSON used to locate the selected node and read its `ac` value and GCP2 display properties. The second provides the current global `netvar` value.

The extension retries authentication once after an HTTP 401 or 403. If the direct Device Coherence API request fails but the GCP2 page has already loaded `window.geoACData`, the extension can use that live-map object as a fallback.

### Polling and health

- Polling interval: **35 seconds**
- Feed is marked **STALE** after: **90 seconds** without a successful capture
- Chart gaps are introduced after: **90 seconds** between samples

The **Refresh now** button triggers an immediate capture attempt.

## Selecting a node

Enter a numeric GCP2 node ID in the **Node** field and press **Load node**.

The extension:

1. refreshes the current live device feed;
2. checks that the requested node exists;
3. switches the selected node;
4. remembers the node in `localStorage`;
5. loads that node's saved notepad;
6. refreshes the stored history shown in the console;
7. immediately captures the newly selected node.

The live feed also populates an HTML datalist so Chrome can suggest currently available node IDs.

## Device Coherence and color levels

The extension records the node's numeric **Device Coherence (`ac`)** value and derives the displayed significance level from the GCP2 map color.

| Level | Reference RGB | Console color |
|---|---:|---|
| Normal | `226, 0, 226` | magenta |
| Elevated | `0, 206, 247` | cyan |
| High | `247, 197, 58` | gold / orange |
| Very High | `255, 255, 0` | yellow |
| Extreme | `255, 255, 222` | near-white |

The Device Coherence card shows the current level as a colored badge and colored left border.

The category is a **node Device Coherence significance level**. It is not the same quantity as Global Network Variance.

## Live chart

The chart displays two simultaneous series:

- **white line:** selected node Device Coherence (`ac`), left Y-axis;
- **cyan line:** Global Network Variance (`netvar`), right Y-axis.

Available time windows:

- **1 h** — default;
- **6 h**;
- **24 h**;
- **All** stored history for the selected node.

The X-axis uses local browser time. When the selected interval crosses a date boundary, the axis also shows the date.

START, EVENT, and END markers are drawn as vertical lines when they fall inside the displayed interval.

The chart deliberately breaks the line when consecutive samples are more than 90 seconds apart. This prevents the UI from drawing a misleading continuous slope across periods when Chrome or the collector was not running.

## Running an experiment

Write the intended condition in the **Intention / experiment description** field *before* starting the trial. The notepad autosaves separately for each selected node.

A simple prospective protocol is:

```text
15 min baseline
START
15 min predefined condition
END
15 min recovery
```

Pressing **START** writes a timestamped START marker containing the current node ID, node label, and complete notepad text. While the experiment is active, the START button becomes bright green and displays **● STARTED**.

**EVENT** can be used for notable occurrences inside the experimental interval.

**END** writes an END marker and closes the active timer according to the stored marker chronology.

For stronger experiments, define the condition and analysis window in advance rather than choosing interesting periods after inspecting the trace.

## Intention notepad

The notepad is stored per node in `localStorage` using the prefix:

```text
cp_gcp2_intention_note_
```

The current notepad content is copied into every START / EVENT / END marker.

This makes the experimental description part of the timestamped record instead of relying on later recollection.

## Browser database

The extension intentionally retains the historical database name for backward compatibility:

```text
ContactProject_GCP2_58114
```

Despite that name, v0.4.2 supports multiple nodes. Every new sample and marker carries its own `node_id`.

Database version:

```text
1
```

Object stores:

```text
samples
markers
```

### Sample record

A new live sample contains fields including:

```json
{
  "type": "sample",
  "captured_at": "ISO-8601 timestamp",
  "source": "gcp2.net direct GCP2 API",
  "capture_reason": "scheduled-poll",
  "node_id": "58114",
  "node_label": "ContactProject.Org",
  "longitude": 0,
  "latitude": 0,
  "ac": 0,
  "numeric_properties": {
    "ac": 0
  },
  "device_level": "Normal",
  "fill_color": "rgb(...)",
  "global_netvar": 0,
  "description": "...",
  "properties": {},
  "raw_feature": {}
}
```

The exact GCP2 feature properties can evolve because `properties` and `raw_feature` preserve the source payload.

### Marker record

```json
{
  "type": "marker",
  "timestamp": "ISO-8601 timestamp",
  "marker": "START",
  "note": "experiment description",
  "node_id": "58114",
  "node_label": "ContactProject.Org"
}
```

Marker types used by the UI are:

```text
START
EVENT
END
```

## Exporting data

Exports apply to the **currently selected node**.

### JSONL

**Export JSONL** writes samples and markers as newline-delimited JSON, sorted by timestamp.

Filename pattern:

```text
GCP2_<NODE>_experiment_<TIMESTAMP>.jsonl
```

JSONL is the preferred format when preserving the full record because it retains the complete sample objects.

### CSV

**Export CSV** writes a flattened analysis-oriented table with:

```text
timestamp
row_type
marker
note
node_id
node_label
ac
device_level
global_netvar
longitude
latitude
source
```

Filename pattern:

```text
GCP2_<NODE>_experiment_<TIMESTAMP>.csv
```

## Full database backup

**Backup DB** exports the complete local database, all markers, and all per-node intention notes into one JSON file.

Backup format identifier:

```text
ContactProject-GCP2-IndexedDB-backup
```

Backup format version:

```text
1
```

The backup contains:

```text
format
format_version
exported_at
database
selected_node
notes
samples
markers
```

This is the recommended long-term browser-data backup.

## Restoring a database

**Restore DB** reads a Contact Project GCP2 backup JSON file and **merges** it into the current database.

Existing records that use the same object-store key are replaced:

- samples are keyed by `captured_at`;
- markers are keyed by `timestamp`.

Per-node intention notes from the backup are restored to `localStorage`.

Restore does not erase unrelated existing records before merging.

## Clearing data

**Clear node** removes only the locally stored samples and markers whose `node_id` matches the currently selected node.

It does not intentionally clear other nodes.

This operation is destructive. Make a **Backup DB** first if the data may be needed later.

## Repository structure

```text
.
├── manifest.json
├── background.js
├── main.js
├── README.md
└── docs/
    ├── ARCHITECTURE.md
    ├── DATA_FORMAT.md
    ├── EXPERIMENT_PROTOCOL.md
    └── TROUBLESHOOTING.md
```

`background.js` handles the Chrome toolbar click and injects `main.js` into the active tab using Chrome's scripting API in the page's **MAIN** world.

`main.js` contains the live API client, UI, IndexedDB storage, experiment markers, charting, import/export, node switching, and persistence logic.

## Scientific interpretation

The extension is an acquisition and annotation tool. It does not determine whether an observed excursion is caused by intention, consciousness, AI interaction, an environmental factor, a statistical fluctuation, or a network-wide change.

A local node excursion should therefore be interpreted alongside the simultaneously recorded **Global Network Variance** and, where possible, against predefined control periods and repeated trials.

The tool is best used for **prospective** experiments:

- define the hypothesis first;
- define the interval first;
- record START / END objectively;
- preserve the raw exported record;
- compare against controls;
- avoid selecting only visually interesting periods after the fact.

## Important limitations

- The extension depends on the current GCP2 website/API structure. GCP2 can change its endpoints, authentication, payload fields, or page implementation.
- This is not a raw-RNG acquisition interface.
- Browser storage is convenient working storage, not a substitute for regular exports and backups.
- The live chart is descriptive and uses independently scaled left/right axes.
- A visual rise in Node AC does not by itself imply a local causal effect.
- Historical samples created by older extension versions may have slightly different field shapes; normalization code supports several earlier `ac` locations.
- If the GCP2 site or Chrome suspends the page, samples will not be collected during the interruption; v0.4.2 displays those intervals as gaps.

## Privacy and security

The extension does not require a Contact Project server. Experimental records are stored locally in the browser until the user explicitly exports them.

The extension obtains the GCP2 site's live API bearer token from the site's own JavaScript and uses it only for same-origin requests to GCP2 endpoints. Do not publish authentication material if the GCP2 implementation changes and tokens ever become user-specific or privileged.

Before posting screenshots publicly, crop out unrelated browser tabs and personally identifying account information.

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

The most common first step after updating the unpacked extension is:

```text
Reload the GCP2 Live Data page, wait for the map to populate, then click the extension icon.
```

## Version note

The Chrome manifest identifies this release as **0.4.2**.

The current source retains some internal v4.1 identifiers for backward/implementation continuity, including the panel ID and runtime debug version. These do not change the user-facing release version or data format, but they may be cleaned up in a later maintenance release.

## Project

Developed for the **Contact Project** as an experimental interface for prospective GCP2 node studies and reproducible experiment annotation.

This repository should not imply endorsement by or affiliation with GCP2 unless such affiliation is separately established.

## License

No license has been selected in this documentation package. Add a `LICENSE` file before describing the repository as open source.
