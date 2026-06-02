---
sidebar_position: 1
title: dmr.h
---

```c
#include "dmr.h"
```

## Types

### DMRSuggestion

Passed to `dmr_check` to select the reconfiguration policy.

| Value | Description |
|-------|-------------|
| `ROUND_POLICY` | Double node count up to `max_nodes`, then wrap to `min_nodes` |
| `LIST_POLICY` | Iterate a fixed list of node counts |
| `CE_POLICY` | Target a communication efficiency value (requires TALP) |
| `SLURM4DMR_ROUND_POLICY` | `ROUND_POLICY` variant for Slurm4DMR |
| `SLURM4DMR_CE_POLICY` | `CE_POLICY` variant for Slurm4DMR |
| `SLURM4DMR_QUEUE_POLICY` | Stay at preferred nodes, respect min/max |
| `SHOULD_EXPAND` | Expand by `DMR_NODES_IN_EXPAND` nodes |
| `SHOULD_SHRINK` | Shrink by `DMR_NODES_IN_SHRINK` nodes |
| `SHOULD_STAY` | Do not reconfigure this iteration |

### DMRAction

Returned by `dmr_init`, `dmr_check`, `dmr_reconfigure`, and `dmr_finalize`.

| Value | Meaning |
|-------|---------|
| `DMR_NO_ACTION` | No action required |
| `DMR_RECONF` | Call `dmr_reconfigure()` |
| `DMR_RESTART_RECONF` | Load checkpoint/data, then call `dmr_reconfigure()` |
| `DMR_REDIST_FINALIZE` | Save/send data, then call `dmr_finalize()` (rank exits) |
| `DMR_FINALIZE` | Call `dmr_finalize()` (rank exits) |
| `DMR_CLEANUP` | Optional cleanup, rank continues |
| `DMR_ERROR` | An error occurred |

### DMRStatus

Returned by setter functions and analytics calls.

| Value | Meaning |
|-------|---------|
| `DMR_SUCCESS` | Success |
| `DMR_ERROR_STATUS` | Unspecified failure |
| `DMR_ERROR_UNINITIALIZED` | Library not yet initialized |
| `DMR_ERROR_NOT_ROOT` | Must be called from rank 0 |
| `DMR_ERROR_ARG_NULL` | A required argument was NULL |
| `DMR_ERROR_BAD_ARGS` | An argument was rejected |
| `DMR_ERROR_UNSUPPORTED` | Not supported in current state or build |
| `DMR_ERROR_OUT_OF_MEM` | Out of memory |

### DMRAnalytics

```c
typedef struct {
    double      event_time;               // Unix timestamp of event
    const char *function;                 // DMR function that emitted the event
    const char *event;                    // Event identifier (DMR_EVENT_* constant)
    int         world_size;               // MPI processes in current MPI_COMM_WORLD
    int         node_count;               // Nodes in current MPI_COMM_WORLD
    double      reconfiguration_time;     // Seconds to complete last reconfiguration (-1 if N/A)
    double      communication_efficiency; // Last TALP accumulated CE (-1 if N/A)
    int         pending_nodes;            // Nodes requested but not yet secured
} DMRAnalytics;
```

## Global variable

```c
extern MPI_Comm DMR_INTERCOMM;
```

Intercommunicator connecting old and new processes during a reconfiguration. Only valid when `dmr_intercomm_available()` returns `1` and `DMR_CHECKPOINT_RESTART=0`.

## Core functions

### dmr_init

```c
DMRAction dmr_init(int argc, char *argv[]);
```

Initialize DMR. Call immediately after `MPI_Init`. **Collective.**

Returns `DMR_NO_ACTION` on first launch, `DMR_RESTART_RECONF` when restarting after a reconfiguration.

### dmr_check

```c
DMRAction dmr_check(DMRSuggestion suggestion);
```

Evaluate the policy and act on any pending reconfiguration. Call in the main loop. **Collective.**

### dmr_reconfigure

```c
DMRAction dmr_reconfigure(void);
```

Perform the reconfiguration. Call only when `dmr_check` returns `DMR_RECONF`. Handled automatically by `DMR_AUTO`.

### dmr_finalize

```c
DMRAction dmr_finalize(void);
```

Shut down DMR. Call before `MPI_Finalize`. Not collective; once a rank calls it, no further DMR calls can be made from that rank.

## Policy setters (collective)

```c
DMRStatus dmr_set_policy_min_nodes(int nodes);
DMRStatus dmr_set_policy_max_nodes(int nodes);
DMRStatus dmr_set_policy_stride(int multiplier);
DMRStatus dmr_set_policy_pref_nodes(int nodes);
DMRStatus dmr_set_reconf_step_inhibitor(int steps);
```

## Expand/shrink sizing (rank 0 only)

```c
DMRStatus dmr_set_nodes_next_expand(int nodes);
DMRStatus dmr_set_procs_next_expand(int procs);
DMRStatus dmr_set_ppn_next_expand(int ppn);
DMRStatus dmr_set_nodes_next_shrink(int nodes);
DMRStatus dmr_set_procs_next_shrink(int procs);
DMRStatus dmr_set_jobs_next_shrink(int jobs);
```

Values reset after each reconfiguration.

## State queries

```c
int dmr_get_current_node_count(void);
int dmr_get_reconfig_count(void);
int dmr_get_active_expansions(void);
int dmr_pending_expansion(void);
int dmr_intercomm_available(void);
int dmr_get_nodes_next_expand(void);
int dmr_get_procs_next_expand(void);
int dmr_get_nodes_next_shrink(void);
int dmr_get_procs_next_shrink(void);
DMRAction dmr_get_last_action(void);
```

## Analytics

```c
DMRStatus dmr_get_analytics(DMRAnalytics *analytics);
DMRStatus dmr_create_custom_analytics_event(char const *event, DMRAnalytics **analytics_out);
DMRStatus dmr_destroy_custom_analytics_event(DMRAnalytics *analytics);
DMRStatus dmr_print_analytics_from(DMRAnalytics const *analytics_in);
```

## Macro

### DMR_AUTO

```c
DMR_AUTO(the_action, redist_func, restart_func, finalize_func)
```

Dispatches to the correct callback based on `the_action`. See [Reconfiguration Handling](../user-guide/reconfiguration-handling) for full documentation.

## Analytics event constants

| Constant | When emitted |
|----------|-------------|
| `DMR_EVENT_NONE` | No event yet |
| `DMR_EVENT_INIT_COMPLETE` | `dmr_init` completed |
| `DMR_EVENT_CHECK_CALLED` | `dmr_check` was called |
| `DMR_EVENT_STAY_CURRENT` | Policy decided to stay |
| `DMR_EVENT_START_EXPAND_SLURM` | Resources requested from Slurm |
| `DMR_EVENT_START_EXPAND_MPI` | MPI expansion started |
| `DMR_EVENT_START_SHRINK` | Shrink triggered |
| `DMR_EVENT_DATA_REDIST_COMPLETE` | Data redistribution finished |
| `DMR_EVENT_TALP_CHECK_CE_ACC` | TALP CE check performed |
| `DMR_EVENT_LAST_FINALIZE` | `dmr_finalize` called outside reconfiguration |
