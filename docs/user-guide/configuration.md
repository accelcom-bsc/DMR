---
sidebar_position: 4
title: Configuration
---

DMR can be configured at compile time (CMake), at launch time (environment variables), and at runtime (setter functions). Environment variables override CMake defaults; runtime setters override environment variables.

:::note
Policy parameters are the exception: they are resolved by each policy when it is constructed, not by DMR. See [Policies Overview](policies/overview#configuring-policies).
:::

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
| `DMR_USE_TALP` | `0` | Compile with DLB/TALP (required by the CE policy) |
| `DMR_BUILD_TEST_POLICIES` | `ON` | Build the round and list policies (`dmr_test_policies.h`) |
| `DMR_BUILD_CE_POLICY` | `ON` when `DMR_USE_TALP=1` | Build the CE policy (`dmr_CE_policy.h`). Requires `DMR_USE_TALP=1` |
| `DMR_MECHANISM` | `spawn` | Reconfiguration mechanism: `spawn` (`MPI_Comm_spawn_multiple`, data over `DMR_INTERCOMM`) or `cr` (checkpoint-restart through the wrapper) |
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
| `DMR_DEFAULT_POLICY_MIN` | `1` | Minimum node count, for the round and CE policies |
| `DMR_DEFAULT_POLICY_MAX` | `1` | Maximum node count, for the round and CE policies |
| `DMR_DEFAULT_POLICY_STRIDE` | `2` | Multiplier for the round policy |
| `DMR_DEFAULT_INHIBITOR` | `0` | Skip N calls to `dmr_check` out of every N+1 |
| `DMR_TALP_TARGET_CE` | `0.8` | Target communication efficiency for the CE policy |
| `DMR_TALP_SENSITIVITY` | `15` | Adjustment sensitivity for the CE policy |

The policy variables are read by the built-in policy constructors (`dmr_get_policy_round()`, `dmr_get_policy_ce()`) each time they are called, and stored in that policy's own state. A [custom policy](policies/custom-policies) reads whatever it wants instead.

## Runtime setter functions

All setters are **collective** (all ranks must call):

```c
dmr_set_policy(dmr_get_policy_round());   /* select the active policy */
dmr_set_reconf_step_inhibitor(4);
```

There are no `dmr_set_policy_min_nodes` / `_max_nodes` / `_stride` / `_pref_nodes` setters any more: those bounds belong to the policy. Re-register a built-in after changing its environment variables, or keep the values in a [custom policy](policies/custom-policies).

Expand/shrink sizing (rank 0 only, reset after each reconfiguration):

```c
dmr_set_nodes_next_expand(4);
dmr_set_ppn_next_expand(8);
dmr_set_procs_next_expand(32);
dmr_set_nodes_next_shrink(2);
dmr_set_procs_next_shrink(16);
```
