# Troubleshooting — GCP2 Experiment Console v0.4.2

## The extension icon does nothing

Confirm that:

```text
1. You are on gcp2.net.
2. The GCP2 Live Data page has loaded.
3. The extension is enabled in chrome://extensions.
4. You loaded the directory that directly contains manifest.json.
```

Reload the GCP2 page and click the extension again.

## "Open the GCP2 Live Data page first"

The script only runs on `gcp2.net` pages.

Open:

```text
https://gcp2.net/data-results/live-data
```

and launch the extension there.

## The feed says WAITING

The console has not yet completed a successful local capture.

Wait for the GCP2 map to populate, then press **Refresh now**.

## The feed says STALE

STALE means more than 90 seconds have elapsed since the last successful collector capture.

It does not necessarily mean the GCP2 numeric value itself should have changed.

Try:

```text
Refresh now
```

If the capture continues to fail, reload the GCP2 page. The status line should display the current error.

## Node not found

The requested numeric node ID must be present in the current live device feed.

Use a node ID visible in the GCP2 map or suggested by the node input.

## Chart shows gaps

That is intentional.

v0.4.2 breaks chart lines whenever consecutive stored samples are more than 90 seconds apart. A gap indicates that the extension does not have continuous observations across that interval.

## Chart looks empty in 1 h mode

If there are fewer than two stored samples inside the selected range, choose 6 h, 24 h, or All.

## Old measurements disappeared after switching nodes

The console filters the display by the selected `node_id`.

Switch back to the original node. The data may still be in IndexedDB.

## Updating the extension

After disabling/removing the older unpacked extension and loading the new folder:

```text
reload the already-open GCP2 Live Data tab
```

An injected script from the old version can remain active in an existing page until reload.

## Protecting stored data

Do not:

```text
clear site data for gcp2.net
delete the Chrome profile
press Clear node accidentally
```

Before maintenance, use **Backup DB**.

## Restore reports a bad backup

The restore tool accepts JSON with:

```json
"format": "ContactProject-GCP2-IndexedDB-backup"
```

and arrays named `samples` and `markers`.

## API changes

The extension depends on GCP2 endpoints and page authentication behavior that can change.

If the GCP2 site changes:

```text
/js/data/api_token.js
/api/getgeogroupac
/api/getcurrentnetvar
```

the collector may require an update.

## Developer inspection

Open Chrome DevTools on the GCP2 page and inspect the Console for JavaScript or fetch errors.

The injected runtime also exposes an internal debugging object on `window.__cpGcp2Runtime`.

In the current 0.4.2 source, that debug object still reports internal version `4.1`; the Chrome manifest version is the authoritative release version.
