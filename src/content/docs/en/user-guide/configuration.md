---
title: Configuration
description: Compile-time and runtime configuration options for DMR.
---

DMR can be configured both at **compile time** (via CMake flags) and at **runtime** (via environment variables).

## Compile-time options

Set these when running CMake:

```bash
cmake -B build \
  -DDMR_PROCS_PER_NODE=112 \
  -DDMR_USE_TALP=1 \
  -DDLB_ROOT=$DLB_ROOT
```

| CMake flag | Default | Description |
|------------|---------|-------------|
| `DMR_PROCS_PER_NODE` | `1` | Number of processes spawned per node added in an expand |
| `DMR_USE_TALP` | `0` | Compile with DLB/TALP support (enables the `ce` policy) |
| `DMR_CHECKPOINT_RESTART` | `0` | Use checkpoint-restart for reconfigurations |
| `DMR_JOBS_CAN_SHRINK` | `1` | Enable Slurm job shrinking |

## Runtime environment variables

Set these before launching your application (`export VAR=value` or inline with `mpirun`).

### Debug and analytics

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_DEBUG_LEVEL` | `0` | `0` = off, `1` = rank 0 only, `2` = all ranks |
| `DMR_PRINT_ANALYTICS` | `0` | Print analytics at each reconfiguration when set to `1` |

### Reconfiguration sizes

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_NODES_IN_EXPAND` | `1` | Nodes to request per expand step |
| `DMR_NODES_IN_SHRINK` | `1` | Nodes to release per shrink step |
| `DMR_PROCS_IN_EXPAND` | *(from CMake)* | Processes to spawn per expand |
| `DMR_PROCS_IN_SHRINK` | `0` | Processes to remove per shrink |

### Policy defaults

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_DEFAULT_POLICY_MIN` | `1` | Minimum node count for built-in policies |
| `DMR_DEFAULT_POLICY_MAX` | `1` | Maximum node count for built-in policies |
| `DMR_DEFAULT_POLICY_PREF` | `1` | Preferred node count |
| `DMR_DEFAULT_POLICY_STRIDE` | `2` | Multiplier used by `dmr_policy_round()` |
| `DMR_TALP_TARGET_CE` | `0.8` | Target communication efficiency for `dmr_policy_ce()` |
| `DMR_TALP_SENSITIVITY` | `15` | Adjustment sensitivity for `dmr_policy_ce()` |

:::tip
Environment variables override compiled defaults. This lets you tune behaviour without recompiling.
:::
