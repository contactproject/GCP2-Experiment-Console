# Data Format — GCP2 Experiment Console v0.4.2

## Storage overview

The extension stores two logical record types:

```text
sample
marker
```

All timestamps are generated with JavaScript `new Date().toISOString()` and therefore stored in UTC ISO-8601 form.

## Sample

Representative structure:

```json
{
  "type": "sample",
  "captured_at": "2026-10-02T04:22:55.000Z",
  "source": "gcp2.net direct GCP2 API",
  "capture_reason": "scheduled-poll",
  "node_id": "58114",
  "node_label": "ContactProject.Org",
  "longitude": 0.0,
  "latitude": 0.0,
  "ac": 104.087,
  "numeric_properties": {
    "ac": 104.087
  },
  "device_level": "Normal",
  "fill_color": "rgb(226, 0, 226)",
  "global_netvar": 193.2942,
  "description": "...",
  "properties": {},
  "raw_feature": {}
}
```

### Field notes

| Field | Meaning |
|---|---|
| `captured_at` | Local collector capture timestamp in UTC ISO-8601 |
| `source` | Acquisition route used by the extension |
| `capture_reason` | e.g. `scheduled-poll`, `manual-refresh`, `console-start`, `node-selected` |
| `node_id` | Selected GCP2 node identifier |
| `node_label` | Label derived from the feature description |
| `longitude`, `latitude` | Coordinates from the live GeoJSON feature |
| `ac` | Device Coherence numeric value |
| `numeric_properties.ac` | Compatibility copy of `ac` |
| `device_level` | Normal / Elevated / High / Very High / Extreme / Unknown |
| `fill_color` | GCP2 source display color |
| `global_netvar` | Simultaneous Global Network Variance value |
| `properties` | Preserved source feature properties |
| `raw_feature` | Preserved source GeoJSON feature |

`properties` and `raw_feature` intentionally preserve more of the upstream payload than is required by the current UI.

## Marker

```json
{
  "type": "marker",
  "timestamp": "2026-10-02T04:25:00.000Z",
  "marker": "START",
  "note": "AI-mediated focused intention — 15 min",
  "node_id": "58114",
  "node_label": "ContactProject.Org"
}
```

Marker types used by the extension:

```text
START
EVENT
END
```

## JSONL export

JSONL preserves complete stored objects. Samples and markers are interleaved chronologically.

One JSON object is written per line.

## CSV export

Columns:

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

Marker rows leave measurement columns blank.

CSV is convenient for statistical packages and spreadsheets, but it omits nested `properties` and `raw_feature` content. Use JSONL or a full DB backup when provenance matters.

## Full backup JSON

Top-level structure:

```json
{
  "format": "ContactProject-GCP2-IndexedDB-backup",
  "format_version": 1,
  "exported_at": "ISO-8601 timestamp",
  "database": "ContactProject_GCP2_58114",
  "selected_node": "58114",
  "notes": {},
  "samples": [],
  "markers": []
}
```

The restore function validates `format`, requires `samples` and `markers` arrays, then merges records by their IndexedDB keys.

## Timestamp-key behavior

Because samples use `captured_at` as the IndexedDB key and markers use `timestamp`, restoring a record with an identical key replaces the existing record at that exact timestamp.

The restore process does not otherwise delete existing database content.
