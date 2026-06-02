---
sidebar_position: 1
title: Overview
---

A **policy** tells DMR how to decide when and how to reconfigure. You select a policy by passing a `DMRSuggestion` value to `dmr_check`.

## DMRSuggestion values

```c
DMRAction action = dmr_check(ROUND_POLICY);
```

| Value | Description |
|-------|-------------|
| `ROUND_POLICY` | Doubles node count up to `max_nodes`, then wraps back to `min_nodes` |
| `LIST_POLICY` | Iterates through a fixed list of node counts |
| `CE_POLICY` | Targets a communication efficiency value (requires TALP) |
| `SLURM4DMR_ROUND_POLICY` | Like `ROUND_POLICY`, adapted for Slurm4DMR mode |
| `SLURM4DMR_CE_POLICY` | Like `CE_POLICY`, adapted for Slurm4DMR mode |
| `SLURM4DMR_QUEUE_POLICY` | Tries to stay at preferred nodes, respects min/max |
| `SHOULD_EXPAND` | Manual: expand by `DMR_NODES_IN_EXPAND` nodes |
| `SHOULD_SHRINK` | Manual: shrink by `DMR_NODES_IN_SHRINK` nodes |
| `SHOULD_STAY` | Manual: do not reconfigure this iteration |

## Configuring policies at runtime

Policy parameters can be set before the main loop. All setters are **collective** (all ranks must call):

```c
dmr_set_policy_min_nodes(2);   // DMR will not go below 2 nodes
dmr_set_policy_max_nodes(16);  // DMR will not go above 16 nodes
dmr_set_policy_stride(2);      // multiplier for ROUND_POLICY
dmr_set_policy_pref_nodes(8);  // preferred count for QUEUE_POLICY
```

Or set them via environment variables (see [Configuration](../user-guide/configuration)):

```bash
DMR_DEFAULT_POLICY_MIN=2 DMR_DEFAULT_POLICY_MAX=16 dmr mpirun -n 2 ./my_app
```

## Manual control

Use `SHOULD_EXPAND` or `SHOULD_SHRINK` when your application decides reconfiguration timing itself:

```c
if (my_app_needs_more_resources()) {
    dmr_set_nodes_next_expand(4);
    DMR_AUTO(dmr_check(SHOULD_EXPAND), save_data(), (void)NULL, cleanup());
}
```

## Inhibitor

Throttle how often DMR attempts a reconfiguration. If the inhibitor is `N`, then `N` out of every `N+1` calls to `dmr_check` are skipped:

```c
dmr_set_reconf_step_inhibitor(9);  // reconfigure on every 10th call
```

Or at compile/run time: `DMR_DEFAULT_INHIBITOR=9`.
