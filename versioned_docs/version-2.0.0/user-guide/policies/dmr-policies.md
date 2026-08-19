---
sidebar_position: 2
title: DMR Policies
---

DMR ships several policies that cover the most common scaling strategies. You select one by passing the corresponding `DMRSuggestion` value to `dmr_check`. All policies respect the `DMR_DEFAULT_POLICY_MIN` and `DMR_DEFAULT_POLICY_MAX` bounds, which you can set via environment variables or the runtime setters.

## ROUND_POLICY

Multiplies the current node count by `stride` at each reconfiguration step. When the result would exceed `max_nodes`, it wraps back to `min_nodes`.

```c
DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());
```

With `MIN=1`, `MAX=8`, `STRIDE=2`: sequence is 1 → 2 → 4 → 8 → 1 → …

| Parameter | Runtime setter | Env var | CMake flag | Default |
|-----------|---------------|---------|------------|---------|
| Minimum nodes | `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN` | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Maximum nodes | `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX` | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Stride (multiplier) | `dmr_set_policy_stride(n)` | `DMR_DEFAULT_POLICY_STRIDE` | `DMR_DEFAULT_POLICY_STRIDE` | `2` |

## LIST_POLICY

Cycles through a hardcoded sequence of node counts `{2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1}`, advancing one step per reconfiguration. Designed for testing and benchmarking.

```c
DMR_AUTO(dmr_check(LIST_POLICY), save(), (void)NULL, cleanup());
```

No configuration parameters.

## CE_POLICY

Measures the accumulated communication efficiency via TALP and adjusts the node count to keep it near a target. Requires `DMR_USE_TALP=1` at compile time.

```c
DMR_AUTO(dmr_check(CE_POLICY), save(), (void)NULL, cleanup());
```

| Parameter | Runtime setter | Env var | CMake flag | Default |
|-----------|---------------|---------|------------|---------|
| Minimum nodes | `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN` | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Maximum nodes | `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX` | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Target CE | — | `DMR_TALP_TARGET_CE` | `DMR_TALP_TARGET_CE` | `0.8` |
| Sensitivity | — | `DMR_TALP_SENSITIVITY` | `DMR_TALP_SENSITIVITY` | `15` |

## Slurm4DMR policies

These variants are designed for Slurm4DMR mode and require `DMR_JOBS_CAN_GROW=1`.

### SLURM4DMR_ROUND_POLICY

Same multiplier logic as `ROUND_POLICY` but operates within a Slurm4DMR allocation.

| Parameter | Runtime setter | Env var | CMake flag | Default |
|-----------|---------------|---------|------------|---------|
| Minimum nodes | `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN` | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Maximum nodes | `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX` | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Stride | `dmr_set_policy_stride(n)` | `DMR_DEFAULT_POLICY_STRIDE` | `DMR_DEFAULT_POLICY_STRIDE` | `2` |

### SLURM4DMR_CE_POLICY

Same communication-efficiency logic as `CE_POLICY` but for Slurm4DMR. Same parameters as CE_POLICY above.

### SLURM4DMR_QUEUE_POLICY

Targets a preferred node count while respecting min and max, consulting cluster status from Slurm4DMR.

```c
DMR_AUTO(dmr_check(SLURM4DMR_QUEUE_POLICY), save(), (void)NULL, cleanup());
```

| Parameter | Runtime setter | Env var | CMake flag | Default |
|-----------|---------------|---------|------------|---------|
| Minimum nodes | `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN` | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Maximum nodes | `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX` | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Preferred nodes | `dmr_set_policy_pref_nodes(n)` | `DMR_DEFAULT_POLICY_PREF` | `DMR_DEFAULT_POLICY_PREF` | `1` |
| Stride | `dmr_set_policy_stride(n)` | `DMR_DEFAULT_POLICY_STRIDE` | `DMR_DEFAULT_POLICY_STRIDE` | `2` |

