---
sidebar_position: 3
title: Manual Reconfiguration Control
---

DMR does not have a custom policy plugin interface yet. Instead, you implement reconfiguration logic directly in your application code and pass `SHOULD_EXPAND`, `SHOULD_SHRINK`, or `SHOULD_STAY` to `dmr_check`.

## Basic pattern

```c
while (should_keep_running()) {
    DMRSuggestion suggestion = my_decide();
    DMR_AUTO(dmr_check(suggestion), save(), (void)NULL, cleanup());
    do_work();
}
```

`my_decide()` is plain application code. It reads DMR state, applies whatever logic fits your workload, and returns a suggestion.

## Key functions for decision logic

| Function | Description |
|----------|-------------|
| `dmr_get_current_node_count()` | Current node count in `MPI_COMM_WORLD` |
| `dmr_get_reconfig_count()` | Number of reconfigurations since launch |
| `dmr_get_active_expansions()` | Number of expansion jobs currently active |
| `dmr_pending_expansion()` | `1` if an expansion is pending |
| `dmr_set_nodes_next_expand(n)` | Request `n` nodes in the next expand |
| `dmr_set_nodes_next_shrink(n)` | Remove `n` nodes in the next shrink |
| `dmr_cancel_expansion()` | Cancel a pending expansion (collective) |

## Example: phase-driven scaling

A common pattern is to scale based on the current phase of computation. Shrink before a communication-heavy phase, expand before a compute-heavy one:

```c
typedef enum { PHASE_COMPUTE, PHASE_COMMUNICATE } Phase;

DMRSuggestion decide(Phase current_phase, int max_nodes, int min_nodes)
{
    int nodes = dmr_get_current_node_count();

    if (current_phase == PHASE_COMPUTE && nodes < max_nodes) {
        dmr_set_nodes_next_expand(max_nodes - nodes);
        return SHOULD_EXPAND;
    }

    if (current_phase == PHASE_COMMUNICATE && nodes > min_nodes) {
        dmr_set_nodes_next_shrink(nodes - min_nodes);
        return SHOULD_SHRINK;
    }

    return SHOULD_STAY;
}
```

## Example: time-window scaling

In time-constrained environments you may want to request resources early and fall back to smaller requests as the deadline approaches. This is the strategy used in [loop-qc](https://gitlab.bsc.es/accelcom/releases/dmr/loop-qc):

```c
/* Try to get max_nodes early in the window. As time runs out,
   halve the target until it is no longer worth expanding.
   Cancel any pending request that is being replaced. */
DMRSuggestion decide_by_window(int max_nodes, int min_nodes,
                               double elapsed_s, double window_s)
{
    double remaining = window_s - elapsed_s;

    if (remaining < 60.0) {
        dmr_cancel_expansion();
        return SHOULD_STAY;
    }

    int target = max_nodes;
    double stage_end = 0.0;
    double fraction = 0.5;

    while (target >= min_nodes * 2) {
        stage_end += window_s * fraction;

        if (elapsed_s <= stage_end) {
            int to_add = target - dmr_get_current_node_count();
            if (to_add > 0) {
                dmr_cancel_expansion();
                dmr_set_nodes_next_expand(to_add);
                return SHOULD_EXPAND;
            }
            return SHOULD_STAY;
        }

        target /= 2;
        fraction /= 2;
    }

    return SHOULD_STAY;
}
```

## Sizing the next operation

Override the number of nodes or processes for the **next** reconfiguration only. Values reset after each reconfiguration.

```c
dmr_set_nodes_next_expand(int nodes);
dmr_set_procs_next_expand(int procs);  // total processes across all new nodes
dmr_set_ppn_next_expand(int ppn);      // processes per node
dmr_set_nodes_next_shrink(int nodes);
dmr_set_procs_next_shrink(int procs);
dmr_set_jobs_next_shrink(int jobs);    // remove N whole expansion jobs
```

## Cancelling a pending expansion

If conditions change and you no longer want a pending expansion:

```c
if (dmr_pending_expansion()) {
    dmr_cancel_expansion();  // collective, all ranks must call
}
```

## Using the inhibitor

To rate-limit how often DMR attempts a reconfiguration regardless of the suggestion:

```c
dmr_set_reconf_step_inhibitor(9);  // 1 in every 10 calls is acted on
DMR_AUTO(dmr_check(SHOULD_EXPAND), save(), (void)NULL, cleanup());
```
