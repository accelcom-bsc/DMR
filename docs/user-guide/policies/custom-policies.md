---
sidebar_position: 3
title: Custom Policies
---

A policy is any `DMRPolicy` struct whose callbacks you implement. There is nothing special about the built-ins: they use the same public interface your own policy does.

```c
typedef struct DMRPolicyStruct {
    char const         *name;        /* for debug output */
    size_t              state_size;  /* sizeof your state struct */
    void               *state;       /* your state, owned by you */
    DMRPolicyPopulateFn populate;    /* optional: gather external data */
    DMRPolicyRunFn      run;         /* required: the decision */
    DMRPolicySaveFn     save;        /* optional: checkpoint state */
    DMRPolicyLoadFn     load;        /* optional: restore state */
    DMRPolicyDestroyFn  destroy;     /* optional: free your state */
} DMRPolicy;
```

The type lives in `dmr_policy.h`, which `dmr.h` already includes.

## The two callbacks

```c
int                 populate(DMRPolicy *policy, DMRPolicyContext const *context);
DMRPolicySuggestion run(DMRPolicy *policy, DMRPolicyContext const *context);
```

- **`populate`** runs on every rank before `run`. Do the side-effecting work here: read metrics, query the cluster, call MPI collectives. Return `0` on success, negative on error (DMR logs it and continues to `run`). May be `NULL`.
- **`run`** must be a pure function of `policy->state` and `context`. It runs on every rank and DMR never broadcasts the result, so **every rank must reach the same decision**. Do not call MPI, read the clock, or use rank-dependent data here.

## Minimal example

Expand one node at a time up to a maximum, then stay.

A custom policy is two pieces:

1. **Your state struct** (`MyPolicyState`): any data `run` needs to decide. DMR never reads it.
2. **A `DMRPolicy`** (`my_policy`): the object you register. It points at your state through `.state` and at your callbacks.

When DMR calls `run`, it passes back the `DMRPolicy` you registered, so your state is reachable as `policy->state`.

The state of this policy is a single bound that never changes, so the constructor fills it once and there is nothing to gather before each decision: `populate` is `NULL`. A policy whose state depends on the running application (metrics, cluster load) fills it in `populate` instead; see [the populate callback](#using-external-data-the-populate-callback).

```c
#include "dmr.h"

/* 1. State */
typedef struct {
    int max_nodes;
} MyPolicyState;

/* 2. Decision */
static DMRPolicySuggestion my_run(DMRPolicy *policy, DMRPolicyContext const *context)
{
    MyPolicyState *s = policy->state;

    if (context->current_nodes < s->max_nodes) {
        return dmr_policy_expand_fixed(1, 0);   /* +1 node, let DMR size the procs */
    }
    return dmr_policy_stay();
}

/* 3. Policy object and its state. Static: they must outlive every dmr_check. */
static MyPolicyState my_policy_state;

static DMRPolicy my_policy = {
    .name       = "expand_to_max",
    .state_size = sizeof(MyPolicyState),
    .state      = &my_policy_state,
    .populate   = NULL,   /* state is fully set by the constructor */
    .run        = my_run,
    .save       = NULL,
    .load       = NULL,
    .destroy    = NULL    /* state is static, nothing to free */
};

/* 4. Constructor: initializes the state and returns the policy to register */
static DMRPolicy *create_my_policy(int max_nodes)
{
    my_policy_state = (MyPolicyState){ .max_nodes = max_nodes };
    return &my_policy;
}

int main(int argc, char **argv)
{
    MPI_Init(&argc, &argv);
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), cleanup());

    dmr_set_policy(create_my_policy(4));  /* collective */

    while (should_keep_running()) {
        DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup());
        do_work();
    }

    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
    MPI_Finalize();
    return 0;
}
```

`load`, `save`, `cleanup`, `should_keep_running` and `do_work` are your application's functions; see [Reconfiguration Handling](../reconfiguration-handling.md) for what each `DMR_AUTO` slot does.

`state_size` is not used by DMR. It lets your callbacks check that `policy->state` really is the struct they expect; the built-in policies return `dmr_policy_stay()` when `policy->state_size != sizeof(their state)`.

## Decision helpers

`run` returns a `DMRPolicySuggestion`:

```c
typedef enum { DMR_POLICY_STAY = 0, DMR_POLICY_EXPAND, DMR_POLICY_SHRINK } DMRPolicyOp;

typedef struct {
    DMRPolicyOp operation;
    int         nodes;      /* delta, always positive */
    int         processes;  /* 0 = let DMR size it */
} DMRPolicySuggestion;
```

You can build it by hand, but `dmr_policy.h` exposes composable helpers that validate the delta for you:

```c
DMRPolicySuggestion dmr_policy_stay(void);
DMRPolicySuggestion dmr_policy_expand_fixed(int nodes, int processes);
DMRPolicySuggestion dmr_policy_shrink_fixed(int nodes, int processes);
DMRPolicySuggestion dmr_policy_expand_to(int target_nodes, int processes, DMRPolicyContext const *ctx);
DMRPolicySuggestion dmr_policy_shrink_to(int target_nodes, int processes, DMRPolicyContext const *ctx);
```

The `_fixed` helpers take a **delta** and fall back to `stay` when it is not positive. The `_to` helpers take an **absolute target** node count and compute the delta from the context, returning `stay` when the target is already reached or points the wrong way.

## Using external data: the populate callback

`populate` is where a policy is allowed to touch the outside world. This is the shape the built-in CE policy uses:

```c
typedef struct {
    double load;
    bool   metrics_available;
} LoadPolicyState;

static int load_populate(DMRPolicy *policy, DMRPolicyContext const *context)
{
    LoadPolicyState *s = policy->state;

    s->metrics_available = false;

    double load = measure_cluster_load();   /* may be an MPI collective */
    if (load >= 0) {
        s->load = load;
        s->metrics_available = true;
    }
    return 0;
}
```

Store the result in your state and let `run` decide from it. Because `populate` runs on all ranks, an MPI collective here is safe; the same call inside `run` is not.

Make `run` handle the "no data this iteration" case explicitly. Returning `dmr_policy_stay()` is almost always the right fallback.

## DMRPolicyContext reference

`DMRPolicyContext` is passed to both callbacks and is read-only.

| Field | Type | Description |
|-------|------|-------------|
| `current_nodes` | `int` | Nodes in the current `MPI_COMM_WORLD` |
| `reconfig_count` | `int` | Reconfigurations completed so far |
| `nodes_in_expand` | `int` | Nodes already queued for the next expand |
| `nodes_in_shrink` | `int` | Nodes already queued for the next shrink |
| `procs_in_expand` | `int` | Processes already queued for the next expand |
| `procs_in_shrink` | `int` | Processes already queued for the next shrink |
| `internal_dmr_state` | `void *` | Opaque `DMRState` pointer, advanced use only |
| `internal_controller_state` | `void *` | Opaque `DMRControllerState` pointer, advanced use only |

The context carries no minimum or maximum node count: bounds are your policy's business, kept in its own state. If you want to follow the built-in convention, resolve them in your constructor and fall back to the `DMR_DEFAULT_POLICY_MIN` / `DMR_DEFAULT_POLICY_MAX` macros from `dmr_config.h`.

## Bounds are yours to enforce

DMR only rejects requests that make no sense at all (an expand that adds nothing, a shrink that removes everything). It requests 500 nodes if your `run` says so. Clamp in `run`:

```c
int target = context->current_nodes + change;

if (target < s->min_nodes) target = s->min_nodes;
if (target > s->max_nodes) target = s->max_nodes;

if (target > context->current_nodes) return dmr_policy_expand_to(target, 0, context);
if (target < context->current_nodes) return dmr_policy_shrink_to(target, 0, context);
return dmr_policy_stay();
```

## Lifecycle and ownership

- **DMR does not own the `DMRPolicy` pointer.** Keep the object alive for as long as the policy might be invoked, that is until after your last `dmr_check`. Static storage or a caller-owned allocation are the simplest options; a stack object that goes out of scope is a use-after-free.
- **`destroy` is never called by DMR.** It exists for policies that allocate heap state; call it yourself when you are done, typically after `dmr_finalize`.
- **`save` / `load`** are optional hooks for persisting policy state across a checkpoint-restart run. DMR does not invoke them for you.
- **`dmr_set_policy` is collective**: all ranks in `MPI_COMM_WORLD` must call it, in the same order, with no `dmr_check` in between. Passing `NULL` unregisters the policy, and `dmr_check(USE_POLICY)` then resolves to `SHOULD_STAY`.
- **DMR is not thread-safe**: never call `dmr_set_policy` from one thread while another is inside `dmr_check`.
