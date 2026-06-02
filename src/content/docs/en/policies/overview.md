---
title: Policies Overview
description: How the DMR policy system works.
---

A **policy** is a pluggable object that DMR calls every iteration to decide whether the job should expand, shrink, or stay at its current size.

## How it works

Every iteration your application calls `dmr_check(USE_POLICY)`. Internally DMR calls two callbacks on the active policy in sequence:

1. **`populate(policy, runtime)`** — gather external information the policy needs (TALP metrics, Slurm queue state, …). Called on *every* MPI rank because some operations here (e.g. DLB's `CollectPOPMetrics`) are MPI collectives. May be `NULL` if the policy needs no external data.

2. **`run(policy, context)`** — pure decision: given the context, return a `DMRPolicySuggestion` (stay / expand N nodes / shrink N nodes). Called on every rank; the result must be deterministic for a given context.

```
dmr_check(USE_POLICY)
    └─ populate(policy, runtime)   ← called on all ranks
    └─ run(policy, context)        ← called on all ranks
    └─ root applies the suggestion to the next action state
    └─ returns DMRAction to caller
```

After `run` returns, DMR translates the suggestion into a `DMRAction` (`DMR_NO_ACTION`, `DMR_RECONF`, …) which is returned to your application via `DMR_AUTO`.

## Registering a policy

Call `dmr_set_policy` before the main loop. It is a **collective** operation — all ranks must call it:

```c
dmr_set_policy(dmr_policy_round());
```

You can change the policy at any point outside of `dmr_check`, as long as all ranks call `dmr_set_policy` in the same order.

## Choosing a policy

| Policy | Best for |
|--------|----------|
| `dmr_policy_always_stay()` | Debugging; disables all reconfigurations |
| `dmr_policy_list()` | Testing a fixed sequence of node counts |
| `dmr_policy_round()` | General use; scales up by a stride, wraps to min |
| `dmr_policy_ce()` | Production; targets a communication efficiency threshold (requires TALP) |

See [Built-in Policies](/en/policies/builtin-policies/) for details, or [Custom Policies](/en/policies/custom-policies/) to implement your own.
