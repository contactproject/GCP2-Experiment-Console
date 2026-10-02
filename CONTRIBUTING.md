# Contributing to GCP2 Experiment Console

Thanks for your interest in improving the Contact Project GCP2 Experiment Console.

This project is an experimental research tool. Contributions are welcome, but changes that affect **data acquisition, timestamps, experiment markers, storage, or statistical interpretation** should be treated more carefully than ordinary cosmetic changes.

## Before contributing

Please read:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_FORMAT.md`
- `docs/EXPERIMENT_PROTOCOL.md`
- `docs/TROUBLESHOOTING.md`

The current public release is **v0.4.2**.

## Development setup

No build system is currently required.

1. Clone or download the repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder containing `manifest.json`.
6. Open the GCP2 Live Data page:
   `https://gcp2.net/data-results/live-data`
7. Wait for the live map to populate.
8. Click the extension icon.

After editing extension files, use **Reload** on the extension card in `chrome://extensions`, then reload the GCP2 tab.

## What to test

At minimum, confirm that:

- the console opens on the GCP2 Live Data page;
- live node data are captured;
- Global Network Variance is captured;
- LIVE / STALE status behaves correctly;
- node switching works;
- the per-node intention notepad persists;
- START / EVENT / END markers are stored with timestamps and notes;
- START remains visibly highlighted during an active run;
- the 1 h / 6 h / 24 h / All chart ranges work;
- collection gaps are not drawn as continuous lines;
- JSONL and CSV exports contain the expected selected-node records;
- DB backup and restore work;
- existing records created by earlier versions still load correctly.

## Backward compatibility

Please preserve compatibility with existing browser data whenever possible.

The historical IndexedDB database name is:

```text
ContactProject_GCP2_58114
```

Despite the name, current versions support multiple nodes. Do not rename the database casually: doing so would make users' existing local datasets appear to disappear.

The code also normalizes several earlier record layouts. Changes to sample fields should preserve existing exports and old records unless there is a documented migration.

## Provenance and research integrity

For changes affecting acquisition or experimental timing:

- do not silently alter timestamps;
- do not smooth, interpolate, or fabricate missing data;
- retain explicit gaps when collection is interrupted;
- do not replace upstream GCP2 values with inferred values;
- preserve the distinction between node Device Coherence (`ac`) and Global Network Variance (`netvar`);
- preserve START / EVENT / END marker chronology;
- keep experiment notes attached to markers;
- document any change to polling cadence, endpoint use, fallback behavior, or storage schema.

The UI may summarize or visualize data, but the stored/exported record should remain inspectable.

## Pull requests

A useful pull request should include:

1. a concise description of the change;
2. why the change is needed;
3. what files were modified;
4. how the change was tested;
5. whether it affects stored data, exports, polling, markers, or timing;
6. screenshots for visible UI changes.

Keep unrelated changes out of the same pull request where practical.

## Bug reports

When reporting a bug, include:

- Chrome version;
- extension version;
- selected GCP2 node;
- whether the feed says LIVE, WAITING, or STALE;
- what you expected to happen;
- what actually happened;
- steps to reproduce;
- a screenshot if useful;
- relevant DevTools console errors.

Do **not** post private credentials, authentication material, or unrelated personal browser information.

## Feature requests

Feature requests are welcome, especially when they improve:

- reproducibility;
- provenance;
- experiment annotation;
- export/backup reliability;
- multi-node comparison;
- visualization without distorting the underlying record.

Please distinguish clearly between a **display feature** and a **change to the acquisition pipeline**.

## Scientific claims

This repository is a data-acquisition and annotation tool. Code contributions should not present anomalous values as proof of consciousness effects, causation, or other interpretations.

Interpretation belongs in analysis, with controls, replication, and appropriate uncertainty.

## License

By contributing, you agree that your contribution may be distributed under the repository's MIT License.
