---
sidebar_position: 5
title: Policy Configuration Reference
---

Policy parameters can be set via environment variables, CMake flags, or runtime setter functions. The three layers follow this priority (highest first):

1. **Runtime** (`dmr_set_policy_*` functions)
2. **Environment variable**
3. **Compile-time CMake flag**

## Environment variables

| Variable | Default | Used by |
|----------|---------|---------|
| `DMR_DEFAULT_POLICY_MIN` | `1` | All automatic policies |
| `DMR_DEFAULT_POLICY_MAX` | `1` | All automatic policies |
| `DMR_DEFAULT_POLICY_STRIDE` | `2` | `ROUND_POLICY`, `SLURM4DMR_ROUND_POLICY` |
| `DMR_DEFAULT_POLICY_PREF` | `1` | `SLURM4DMR_QUEUE_POLICY` |
| `DMR_TALP_TARGET_CE` | `0.8` | `CE_POLICY`, `SLURM4DMR_CE_POLICY` |
| `DMR_TALP_SENSITIVITY` | `15` | `CE_POLICY`, `SLURM4DMR_CE_POLICY` |
| `DMR_DEFAULT_INHIBITOR` | `0` | All policies |

## Runtime setter functions

All setters are **collective**; all MPI ranks must call them:

```c
dmr_set_policy_min_nodes(int nodes);
dmr_set_policy_max_nodes(int nodes);
dmr_set_policy_stride(int multiplier);
dmr_set_policy_pref_nodes(int nodes);
dmr_set_reconf_step_inhibitor(int steps);
```

## Expand / shrink sizing

Override the number of nodes or processes for the **next** operation only (resets after reconfiguration):

```c
dmr_set_nodes_next_expand(int nodes);
dmr_set_procs_next_expand(int procs);   // total processes across all new nodes
dmr_set_ppn_next_expand(int ppn);       // processes per node
dmr_set_nodes_next_shrink(int nodes);
dmr_set_procs_next_shrink(int procs);
dmr_set_jobs_next_shrink(int jobs);     // remove N whole expansion jobs
```
