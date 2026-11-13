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
| `pending_nodes` | int | Nodes requested but not yet granted |

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
| `DMR_EVENT_STAY_CURRENT` | The configuration is left unchanged |
| `DMR_EVENT_EXPAND_RESOURCES_START` | `dmr_check` requested more resources from the resource manager |
| `DMR_EVENT_DVM_WAIT_START` | The resource manager answered; the DVM is bringing the granted nodes up |
| `DMR_EVENT_EXPAND_RESOURCES_END` | The requested resources were reported ready |
| `DMR_EVENT_SHRINK_TRIGGERED` | `dmr_check` started a shrink |
| `DMR_EVENT_INTERNAL_STATE_STORE_START` / `_END` | DMR stores its internal state for the relaunch |
| `DMR_EVENT_SPAWN_START` / `_END` | DMR spawns the new processes |
| `DMR_EVENT_REDIST_PARENT_START` / `_END` | The application sends data to the incoming processes |
| `DMR_EVENT_REDIST_CHILD_START` / `_END` | The application receives data from the outgoing processes |
| `DMR_EVENT_RECONFIG_COMPLETE` | Every step of a reconfiguration completed |
| `DMR_EVENT_TALP_CHECK_CE_ACC` | TALP communication efficiency check performed |
| `DMR_EVENT_LAST_FINALIZE` | `dmr_finalize` called outside a reconfiguration |

Between `EXPAND_RESOURCES_START` and `DVM_WAIT_START` the wait is the scheduler's, and after it the runtime's. `DVM_WAIT_START` is only emitted where the resource provider answers in two phases.

A `_START` event does not guarantee a matching `_END`. An expansion request that fails or is cancelled records neither. `DVM_WAIT_START` and `EXPAND_RESOURCES_END` carry the time the resource manager or the DVM reported, so they can be printed after events with a later time.

The macro names are API. The strings they expand to may change in a minor release, so compare against the macro.

## Custom analytics events

Print your own analytics line at any point with `dmr_print_custom_analytics_event`. It labels a snapshot of the current DMR runtime state with your event string and prints it in the same format as built-in events, so the notebook can read it.

```c
dmr_print_custom_analytics_event("MY_APP_PHASE_START");
```

It prints only when analytics are enabled. The `DMR_EVENT_` prefix is reserved for DMR's own events: an event starting with it returns `DMR_ERROR_BAD_ARGS`.

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
