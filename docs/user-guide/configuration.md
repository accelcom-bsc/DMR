---
sidebar_position: 4
title: Configuration
---

DMR can be configured at compile time (CMake), at launch time (environment variables), and at runtime (setter functions). Environment variables override CMake defaults; runtime setters override environment variables.

## CMake options

```bash
cmake -B build \
  -DCMAKE_INSTALL_PREFIX=/path/to/install \
  -DDMR_PROCS_PER_NODE=112 \
  -DDMR_USE_TALP=1 \
  -DDLB_ROOT=$DLB_PREFIX
```

| Option | Default | Description |
|--------|---------|-------------|
| `CMAKE_INSTALL_PREFIX` | system default | Installation directory for headers and `libdmr` |
| `DMR_PROCS_PER_NODE` | `1` | Processes spawned per node added in an expand |
| `DMR_USE_TALP` | `0` | Compile with DLB/TALP (enables CE policies) |
| `DMR_CHECKPOINT_RESTART` | `1` | Use checkpoint-restart for reconfigurations. Set to `0` to use the intercommunicator (`DMR_INTERCOMM`) instead |
| `DMR_JOBS_CAN_SHRINK` | `1` | Enable Slurm job shrinking |
| `DMR_JOBS_CAN_GROW` | `0` | Enable Slurm job growing (requires `DMR_JOBS_CAN_SHRINK=1`) |
| `DMR_BLOCKING_REQ` | `0` | Block in `dmr_check` until resources are acquired. Useful with Slurm4DMR |
| `DMR_NODES_IN_EXPAND` | `1` | Default nodes to add per expand step |
| `DMR_NODES_IN_SHRINK` | `1` | Default nodes to remove per shrink step |
| `DMR_SKIP_SSH_CHECK` | `0` | Skip SSH health check on new nodes before expanding |
| `DMR_SSH_CHECK_TIMEOUT` | `20` | Seconds to wait for SSH health check before continuing |

## Runtime environment variables

### Debug and analytics

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_DEBUG_LEVEL` | `0` | `0` = off, `1` = rank 0 only, `2` = all ranks |
| `DMR_PRINT_ANALYTICS` | `0` | Print analytics line at each reconfiguration when `1` |

### Expand/shrink sizing

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_NODES_IN_EXPAND` | `1` | Default nodes per expand |
| `DMR_NODES_IN_SHRINK` | `1` | Default nodes per shrink |
| `DMR_PROCS_PER_NODE` | *(from CMake)* | Processes per node in an expand |

### Policy

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_DEFAULT_POLICY_MIN` | `1` | Minimum node count |
| `DMR_DEFAULT_POLICY_MAX` | `1` | Maximum node count |
| `DMR_DEFAULT_POLICY_STRIDE` | `2` | Multiplier for `ROUND_POLICY` |
| `DMR_DEFAULT_POLICY_PREF` | `1` | Preferred nodes for `SLURM4DMR_QUEUE_POLICY` |
| `DMR_DEFAULT_INHIBITOR` | `0` | Skip N calls to `dmr_check` out of every N+1 |
| `DMR_TALP_TARGET_CE` | `0.8` | Target communication efficiency for CE policies |
| `DMR_TALP_SENSITIVITY` | `15` | Adjustment sensitivity for CE policies |

## Runtime setter functions

All setters are **collective** (all ranks must call):

```c
dmr_set_policy_min_nodes(2);
dmr_set_policy_max_nodes(16);
dmr_set_policy_stride(2);
dmr_set_policy_pref_nodes(8);
dmr_set_reconf_step_inhibitor(4);
```

Expand/shrink sizing (rank 0 only, reset after each reconfiguration):

```c
dmr_set_nodes_next_expand(4);
dmr_set_ppn_next_expand(8);
dmr_set_procs_next_expand(32);
dmr_set_nodes_next_shrink(2);
dmr_set_procs_next_shrink(16);
```
