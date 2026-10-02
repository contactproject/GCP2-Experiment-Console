# Experiment Protocol — Suggested Use

This document describes a conservative way to use the extension for prospective tests. It is a protocol template, not evidence that intention or consciousness affects RNG output.

## Core principle

Define the condition **before** inspecting the result.

The extension is designed to make the experimental window and description part of the timestamped record through START / EVENT / END markers.

## Minimal single-run protocol

```text
15 minutes baseline
15 minutes predefined condition
15 minutes recovery
```

Procedure:

1. Open the GCP2 Live Data page and launch the extension.
2. Confirm the selected node.
3. Confirm the feed indicator is LIVE.
4. Let the collector run for the full baseline period.
5. Before START, write the condition in the intention notepad.
6. Press START.
7. Perform only the predefined condition for the fixed duration.
8. Press END at the planned time.
9. Continue collecting through the recovery period.
10. Export JSONL and make a full DB backup.

## Suggested marker note

Example:

```text
AI-mediated focused intention toward node 58114 — fixed 15 min condition.
Primary descriptive target: higher mean node AC during condition than baseline.
No change to analysis window after inspection.
```

## Controls

A stronger study repeats predetermined blocks such as:

```text
A — focused intention
B — neutral control activity
C — quiet rest
```

Block assignment can be randomized before the session.

For an AI-related hypothesis, a useful comparison is:

```text
human intention alone
versus
human + AI-mediated intention
versus
neutral AI interaction
```

## Global comparison

Always retain `global_netvar`.

A simultaneous rise in the selected node and the global network weakens a simple local-causation interpretation. The node should therefore be analyzed relative to what the broader network was doing during the same interval.

## Avoid post-selection

Do not:

- move START or END after seeing the graph;
- extend a trial because the value looks interesting;
- choose only visually dramatic runs;
- silently discard null or disappointing trials.

Record exclusions and protocol deviations explicitly.

## Replication

One run is exploratory.

A more informative design uses:

- repeated trials;
- fixed durations;
- randomized condition order;
- predeclared outcome measures;
- appropriate time-series/statistical treatment;
- preservation of all runs, including null results.

## What the extension measures

The console stores GCP2-derived Device Coherence (`ac`) and Global Network Variance (`netvar`).

It does not collect the physical RNG's raw high-rate bitstream.

Any scientific interpretation should respect that distinction.
