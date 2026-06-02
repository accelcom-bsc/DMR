---
title: Custom Policies
description: How to implement your own DMR reconfiguration policy.
---

A policy is any `DMRPolicy` struct whose callbacks you implement. The struct is defined in `include/dmr_policies.h`.

## DMRPolicy struct

```c
struct DMRPolicyStruct {
    char const          *name;
    size_t               state_size;
    void                *state;
    DMRPolicyPopulateFn  populate;
    DMRPolicyRunFn       run;
    DMRPolicySaveFn      save;
    DMRPolicyLoadFn      load;
    DMRPolicyDestroyFn   destroy;
};
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable name for logging |
| `state_size` | Yes | Size of your state struct in bytes |
| `state` | Yes | Pointer to your state |
| `populate` | No | Collect external data before `run`; may be `NULL` |
| `run` | Yes | Pure decision function; returns a `DMRPolicySuggestion` |
| `save` | No | Serialize state for checkpoint-restart |
| `load` | No | Restore state from checkpoint |
| `destroy` | No | Free heap memory in state |

## Minimal example

```c
#include "dmr.h"
#include "dmr_policies.h"
#include <string.h>

typedef struct {
    int current_nodes;
    int max_nodes;
} MyPolicyState;

static int my_populate(DMRPolicy *policy, DMRPolicyContext const *context)
{
    MyPolicyState *s = (MyPolicyState *)policy->state;
    s->current_nodes = context->current_nodes;
    return 0;
}

static DMRPolicySuggestion my_run(DMRPolicy *policy, DMRPolicyContext const *context)
{
    (void)context;
    MyPolicyState *s = (MyPolicyState *)policy->state;

    if (s->current_nodes < s->max_nodes)
        return dmr_policy_expand_fixed(1, 0);
    return dmr_policy_stay();
}

typedef struct {
    DMRPolicy      policy;
    MyPolicyState  state;
} MyPolicy;

static void create_my_policy(MyPolicy *p, int max_nodes)
{
    p->state = (MyPolicyState){ .max_nodes = max_nodes };
    p->policy = (DMRPolicy){
        .name       = "my_expand_to_max",
        .state_size = sizeof(MyPolicyState),
        .state      = &p->state,
        .populate   = my_populate,
        .run        = my_run,
    };
}

int main(int argc, char **argv)
{
    MPI_Init(&argc, &argv);
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, (void)NULL, (void)NULL);

    MyPolicy my_policy;
    create_my_policy(&my_policy, 4);
    dmr_set_policy(&my_policy.policy);

    while (should_keep_running()) {
        DMR_AUTO(dmr_check(USE_POLICY), redistribute(), redistribute(), cleanup());
        do_work();
    }

    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
    MPI_Finalize();
    return 0;
}
```

## Decision helpers

Use these composable helpers inside your `run` callback instead of building `DMRPolicySuggestion` manually:

```c
DMRPolicySuggestion dmr_policy_stay(void);
DMRPolicySuggestion dmr_policy_expand_fixed(int nodes, int processes);
DMRPolicySuggestion dmr_policy_shrink_fixed(int nodes, int processes);
DMRPolicySuggestion dmr_policy_expand_to(int target, int procs, DMRPolicyContext const *ctx);
DMRPolicySuggestion dmr_policy_shrink_to(int target, int procs, DMRPolicyContext const *ctx);
DMRPolicySuggestion dmr_policy_expand_to_max(DMRPolicyContext const *ctx);
DMRPolicySuggestion dmr_policy_shrink_to_min(DMRPolicyContext const *ctx);
```

## Lifecycle and ownership

- DMR does **not** own the `DMRPolicy` pointer. Keep the object alive until after `dmr_finalize`.
- `destroy` is **not** called automatically. Call it yourself after `dmr_finalize` if your state uses heap memory.
- `dmr_set_policy` is **collective** — all ranks must call it in the same order without intervening `dmr_check` calls.
