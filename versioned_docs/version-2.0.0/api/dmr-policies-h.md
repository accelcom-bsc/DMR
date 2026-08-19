---
sidebar_position: 2
title: Policy API
---
## Selecting a policy

Pass a `DMRSuggestion` value to `dmr_check`:

```c
#include "dmr.h"

DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());
```

See [DMRSuggestion](core-api#dmrsuggestion) for all available values.

## Policy bounds (collective)

```c
DMRStatus dmr_set_policy_min_nodes(int nodes);
DMRStatus dmr_set_policy_max_nodes(int nodes);
DMRStatus dmr_set_policy_stride(int multiplier);
DMRStatus dmr_set_policy_pref_nodes(int nodes);
DMRStatus dmr_set_reconf_step_inhibitor(int steps);
```

## Expand/shrink sizing (rank 0 only)

Values apply to the next reconfiguration only and reset afterwards.

```c
DMRStatus dmr_set_nodes_next_expand(int nodes);
DMRStatus dmr_set_procs_next_expand(int procs);
DMRStatus dmr_set_ppn_next_expand(int ppn);
DMRStatus dmr_set_nodes_next_shrink(int nodes);
DMRStatus dmr_set_procs_next_shrink(int procs);
DMRStatus dmr_set_jobs_next_shrink(int jobs);
```

## Expansion control (collective)

```c
DMRStatus dmr_cancel_expansion(void);
```

## State queries

```c
int dmr_get_current_node_count(void);
int dmr_get_reconfig_count(void);
int dmr_get_active_expansions(void);
int dmr_pending_expansion(void);
int dmr_get_nodes_next_expand(void);
int dmr_get_procs_next_expand(void);
int dmr_get_nodes_next_shrink(void);
int dmr_get_procs_next_shrink(void);
```

For usage patterns see [Policies Overview](../user-guide/policies/overview) and [DMR Policies](../user-guide/policies/dmr-policies).
