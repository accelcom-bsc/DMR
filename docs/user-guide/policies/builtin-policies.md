---
sidebar_position: 2
title: Built-in Policies
---

## ROUND_POLICY

Doubles the current node count at each reconfiguration step. When the result would exceed `max_nodes`, it wraps back to `min_nodes`.

```c
dmr_set_policy_min_nodes(1);
dmr_set_policy_max_nodes(8);
dmr_set_policy_stride(2);      // default: 2

DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());
```

With `MIN=1`, `MAX=8`, `STRIDE=2`: sequence is 1 → 2 → 4 → 8 → 1 → …

**Environment variables:** `DMR_DEFAULT_POLICY_MIN`, `DMR_DEFAULT_POLICY_MAX`, `DMR_DEFAULT_POLICY_STRIDE`

## LIST_POLICY

Iterates through a fixed sequence of configurations and repeats. Useful for benchmarking specific node counts.

**Environment variables:** `DMR_DEFAULT_POLICY_MIN`, `DMR_DEFAULT_POLICY_MAX`

## CE_POLICY

Adjusts node count to keep communication efficiency near a target value. Requires `DMR_USE_TALP=1` at compile time.

```c
// Target 80% communication efficiency
// DMR_TALP_TARGET_CE=0.8 DMR_TALP_SENSITIVITY=15
DMR_AUTO(dmr_check(CE_POLICY), save(), (void)NULL, cleanup());
```

**Environment variables:** `DMR_DEFAULT_POLICY_MIN`, `DMR_DEFAULT_POLICY_MAX`, `DMR_TALP_TARGET_CE`, `DMR_TALP_SENSITIVITY`

## SLURM4DMR_ROUND_POLICY / SLURM4DMR_CE_POLICY / SLURM4DMR_QUEUE_POLICY

Variants of the above policies adapted for Slurm4DMR mode. `SLURM4DMR_QUEUE_POLICY` tries to maintain the preferred node count while respecting `min_nodes` and `max_nodes`.

```c
dmr_set_policy_pref_nodes(4);  // target node count for QUEUE_POLICY
DMR_AUTO(dmr_check(SLURM4DMR_QUEUE_POLICY), save(), (void)NULL, cleanup());
```

**Environment variables:** `DMR_DEFAULT_POLICY_PREF`

## Manual control: SHOULD_EXPAND / SHOULD_SHRINK / SHOULD_STAY

Pass these when your application decides when to reconfigure:

```c
// Override the number of nodes for the next operation
dmr_set_nodes_next_expand(2);
DMR_AUTO(dmr_check(SHOULD_EXPAND), save(), (void)NULL, cleanup());

dmr_set_nodes_next_shrink(1);
DMR_AUTO(dmr_check(SHOULD_SHRINK), save(), (void)NULL, cleanup());

// Skip this iteration entirely
DMR_AUTO(dmr_check(SHOULD_STAY), (void)NULL, (void)NULL, (void)NULL);
```
