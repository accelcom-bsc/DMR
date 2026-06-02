---
title: Built-in Policies
description: Reference for all DMR built-in reconfiguration policies.
---

DMR ships four built-in policies. All are constructed with zero-argument accessor functions and their defaults are read from environment variables at startup.

## always_stay

```c
DMRPolicy *dmr_policy_always_stay(void);
```

Never reconfigures. Useful for disabling reconfiguration during debugging without changing application code.

## list

```c
DMRPolicy *dmr_policy_list(void);
```

Cycles through a fixed list of node counts in order, then repeats from the start. Useful for benchmarking and testing specific reconfiguration sequences.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_DEFAULT_POLICY_MIN` | `1` | Start of the list |
| `DMR_DEFAULT_POLICY_MAX` | `1` | End of the list |

## round

```c
DMRPolicy *dmr_policy_round(void);
```

Multiplies the current node count by `DMR_DEFAULT_POLICY_STRIDE` at each step. When the result exceeds `max_nodes`, wraps back to `min_nodes`. Good general-purpose policy for throughput-oriented workloads.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_DEFAULT_POLICY_MIN` | `1` | Minimum nodes; wrap target |
| `DMR_DEFAULT_POLICY_MAX` | `1` | Maximum nodes; wrap threshold |
| `DMR_DEFAULT_POLICY_STRIDE` | `2` | Multiplier applied each step |

**Example:** with `MIN=1`, `MAX=8`, `STRIDE=2`, the sequence is 1 → 2 → 4 → 8 → 1 → …

## ce (Communication Efficiency)

```c
#if defined(COMPILED_WITH_TALP)
DMRPolicy *dmr_policy_ce(void);
#endif
```

A TALP-based policy that measures the application's communication efficiency and adjusts node count to keep it near a target. Only available when compiled with `DMR_USE_TALP=1`.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_DEFAULT_POLICY_MIN` | `1` | Minimum nodes |
| `DMR_DEFAULT_POLICY_MAX` | `1` | Maximum nodes |
| `DMR_TALP_TARGET_CE` | `0.8` | Target communication efficiency (0–1) |
| `DMR_TALP_SENSITIVITY` | `15` | Adjustment sensitivity |

## Shared defaults

All built-in policies share these:

| Variable | Default | Description |
|----------|---------|-------------|
| `DMR_DEFAULT_POLICY_MIN` | `1` | Minimum nodes |
| `DMR_DEFAULT_POLICY_MAX` | `1` | Maximum nodes |
| `DMR_DEFAULT_POLICY_PREF` | `1` | Preferred nodes (used by policies that have a preference) |
