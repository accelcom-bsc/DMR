---
sidebar_position: 5
title: Analytics
---

DMR can log structured analytics lines at each reconfiguration event. These logs can be visualized with the Jupyter notebook provided in `viz/`.

## Enabling analytics

Set before launching your application:

```bash
export DMR_PRINT_ANALYTICS=1
dmr mpirun ...
```

Or enable it permanently at compile time:

```bash
cmake -B build -DDMR_PRINT_ANALYTICS=1
```

## Log format

Each analytics line has the following CSV format:

```
[DMR ANALYTICS],<timestamp>,<function>,<event>,<world_size>,<node_count>,<reconfig_time>,<ce>,<pending_nodes>
```

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | float | Unix timestamp when the event was recorded |
| `function` | string | DMR function that emitted the event |
| `event` | string | Event identifier (see below) |
| `world_size` | int | Number of MPI processes in `MPI_COMM_WORLD` |
| `node_count` | int | Number of nodes in `MPI_COMM_WORLD` |
| `reconfig_time` | float | Seconds to complete the last reconfiguration, or `-1` if not applicable |
| `ce` | float | Last TALP accumulated communication efficiency, or `-1` if not available |
| `pending_nodes` | int | Nodes requested from Slurm but not yet allocated |

Example line:

```
[DMR ANALYTICS],1748000123.45,dmr_check,DMR_EVENT_CHECK_CALLED,8,8,-1.00,-1.000000,0
```

## Events

| Event | When emitted |
|-------|-------------|
| `DMR_EVENT_NONE` | No event yet |
| `DMR_EVENT_INIT_COMPLETE` | `dmr_init` completed |
| `DMR_EVENT_CHECK_CALLED` | `dmr_check` was called |
| `DMR_EVENT_STAY_CURRENT` | Policy decided to stay at current size |
| `DMR_EVENT_START_EXPAND_SLURM` | Resources requested from Slurm |
| `DMR_EVENT_START_EXPAND_MPI` | MPI expansion process started |
| `DMR_EVENT_START_SHRINK` | Shrink triggered |
| `DMR_EVENT_DATA_REDIST_COMPLETE` | Data redistribution finished |
| `DMR_EVENT_TALP_CHECK_CE_ACC` | TALP communication efficiency check performed |
| `DMR_EVENT_LAST_FINALIZE` | `dmr_finalize` called outside a reconfiguration |

## Custom analytics events

You can emit your own analytics lines at any point using `dmr_create_custom_analytics_event`. This creates a snapshot of the current DMR runtime state tagged with your event string, which is then printed in the same format as built-in events and can be read by the notebook.

```c
DMRAnalytics *event;

// Create a snapshot tagged with your event name
dmr_create_custom_analytics_event("MY_APP_PHASE_START", &event);

// Print it (only emits a line if DMR_PRINT_ANALYTICS=1)
dmr_print_analytics_from(event);

// Free when done
dmr_destroy_custom_analytics_event(event);
```

The event string must not collide with the built-in `DMR_EVENT_*` constants.

## Visualizing with the Jupyter notebook

The notebook `viz/dmr_analytics_visualizer.ipynb` reads analytics logs and produces graphs. It filters `[DMR ANALYTICS]` lines automatically so you can feed it raw application output without preprocessing.

### Available graphs

| Graph | Requires |
|-------|----------|
| Node/Process count over time | `DMR_PRINT_ANALYTICS=1` |
| Node/Process count over iteration | `DMR_PRINT_ANALYTICS=1`, iterative app with `dmr_check` per iteration |
| Node count + pending nodes over time or iteration | `DMR_PRINT_ANALYTICS=1` |
| Node count + communication efficiency over time or iteration | `DMR_PRINT_ANALYTICS=1` + `DMR_USE_TALP=1` |

### Setup: with Nix (recommended)

The `viz/` folder has a `flake.nix` with all Python dependencies (pandas, matplotlib, numpy, Jupyter).

**One-shot launch:**

```bash
cd viz/
nix run
```

Opens Jupyter Notebook at `http://127.0.0.1:8888` automatically.

**Dev shell (for more control):**

```bash
cd viz/
nix develop
jupyter notebook --ip=127.0.0.1
# or: jupyter lab --ip=127.0.0.1
```

:::caution
Use `--ip=127.0.0.1` explicitly. The default `localhost` may fail to open in some browsers.
:::

### Setup: manual

Install the dependencies with pip:

```bash
pip install jupyter notebook pandas matplotlib numpy
```

Then launch:

```bash
cd viz/
jupyter notebook --ip=127.0.0.1
```

### Usage

1. Place your log file in the `viz/` folder (or provide its absolute path).
2. Open `dmr_analytics_visualizer.ipynb`.
3. Edit the first cell to point to your log file:

```python
dmr_log_files = [ "my_run.out" ]
```

4. Run all cells. The notebook supports multiple log files for comparison.
