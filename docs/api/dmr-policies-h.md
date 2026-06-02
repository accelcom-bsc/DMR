---
sidebar_position: 2
title: Policy API summary
---

DMR's policy system is entirely contained in `dmr.h` — there is no separate `dmr_policies.h`. Policies are selected by passing a `DMRSuggestion` enum value to `dmr_check`.

## Quick reference

```c
#include "dmr.h"

// Select policy
DMRAction action = dmr_check(ROUND_POLICY);

// Configure policy bounds (collective)
dmr_set_policy_min_nodes(2);
dmr_set_policy_max_nodes(16);
dmr_set_policy_stride(2);
dmr_set_policy_pref_nodes(8);   // for SLURM4DMR_QUEUE_POLICY

// Manual sizing overrides (rank 0 only, reset after each reconf)
dmr_set_nodes_next_expand(4);
dmr_set_ppn_next_expand(8);     // processes per node
dmr_set_nodes_next_shrink(2);
```

For the full type and function documentation see [dmr.h](dmr-h).

For usage patterns see [Policies Overview](../policies/overview) and [Built-in Policies](../policies/builtin-policies).
