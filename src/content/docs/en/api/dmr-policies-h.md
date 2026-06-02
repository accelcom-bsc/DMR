---
title: dmr_policies.h
description: Complete API reference for the DMR policy header.
---

Include `dmr_policies.h` to use built-in policies or implement custom ones.

```c
#include "dmr_policies.h"
```

## Types

### DMRPolicyOp

```c
typedef enum DMRPolicyOpEnum {
    DMR_POLICY_STAY = 0,
    DMR_POLICY_EXPAND,
    DMR_POLICY_SHRINK
} DMRPolicyOp;
```

### DMRPolicySuggestion

Returned by a policy's `run` callback.

```c
typedef struct DMRPolicySuggestionStruct {
    DMRPolicyOp operation;
    int         nodes;
    int         processes;
} DMRPolicySuggestion;
```

### DMRPolicyContext

Passed to `populate` and `run` callbacks. All fields are read-only. See [Policy Context Reference](/en/policies/policy-context-reference/) for the full field list.

### DMRPolicy

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

## Built-in policy constructors

```c
DMRPolicy *dmr_policy_always_stay(void);
DMRPolicy *dmr_policy_list(void);
DMRPolicy *dmr_policy_round(void);

#if defined(COMPILED_WITH_TALP)
DMRPolicy *dmr_policy_ce(void);
#endif
```

See [Built-in Policies](/en/policies/builtin-policies/) for descriptions.

## Decision helpers

Use these inside a custom `run` callback:

```c
DMRPolicySuggestion dmr_policy_stay(void);
DMRPolicySuggestion dmr_policy_expand_fixed(int nodes, int processes);
DMRPolicySuggestion dmr_policy_shrink_fixed(int nodes, int processes);
DMRPolicySuggestion dmr_policy_expand_to(int target_nodes, int processes,
                                          DMRPolicyContext const *context);
DMRPolicySuggestion dmr_policy_shrink_to(int target_nodes, int processes,
                                          DMRPolicyContext const *context);
DMRPolicySuggestion dmr_policy_expand_to_max(DMRPolicyContext const *context);
DMRPolicySuggestion dmr_policy_shrink_to_min(DMRPolicyContext const *context);
```

| Helper | Description |
|--------|-------------|
| `dmr_policy_stay()` | Return a no-op suggestion |
| `dmr_policy_expand_fixed(n, p)` | Expand by exactly `n` nodes and `p` processes |
| `dmr_policy_shrink_fixed(n, p)` | Shrink by exactly `n` nodes and `p` processes |
| `dmr_policy_expand_to(t, p, ctx)` | Expand to `t` total nodes |
| `dmr_policy_shrink_to(t, p, ctx)` | Shrink to `t` total nodes |
| `dmr_policy_expand_to_max(ctx)` | Expand to `context->max_nodes` |
| `dmr_policy_shrink_to_min(ctx)` | Shrink to `context->min_nodes` |
