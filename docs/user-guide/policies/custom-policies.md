---
sidebar_position: 3
title: Custom Policy Logic
---

DMR does not have a plugin policy interface; reconfiguration decisions live in your application code. You implement the logic yourself and pass `SHOULD_EXPAND`, `SHOULD_SHRINK`, or `SHOULD_STAY` to `dmr_check` accordingly.

## Pattern

```c
while (should_keep_running()) {
    DMRSuggestion suggestion = my_policy_decide();
    DMR_AUTO(dmr_check(suggestion), save_data(), (void)NULL, cleanup());
    do_work();
}
```

## Example: expand until a node limit, then shrink

```c
static DMRSuggestion my_policy_decide(void)
{
    int nodes = dmr_get_current_node_count();
    int max   = 8;

    if (nodes < max) {
        dmr_set_nodes_next_expand(1);
        return SHOULD_EXPAND;
    }
    dmr_set_nodes_next_shrink(nodes - 1);
    return SHOULD_SHRINK;
}
```

## Example: skip N iterations between reconfigurations

Use the built-in inhibitor instead of manual counting:

```c
dmr_set_reconf_step_inhibitor(9);  // reconfigure once every 10 calls
```

Or combine both:

```c
dmr_set_reconf_step_inhibitor(4);  // 1 in 5 calls attempts a reconfiguration
DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());
```

## Cancelling a pending expansion

If your application decides it no longer wants an expansion that is already in progress:

```c
if (dmr_pending_expansion() && no_longer_need_resources()) {
    dmr_cancel_expansion();  // collective, all ranks must call
}
```

## Reading runtime state

| Function | Returns |
|----------|---------|
| `dmr_get_current_node_count()` | Nodes in current `MPI_COMM_WORLD` |
| `dmr_get_reconfig_count()` | Number of reconfigurations since launch |
| `dmr_get_active_expansions()` | Number of expansion jobs currently active |
| `dmr_pending_expansion()` | `1` if an expansion job is pending |
| `dmr_get_nodes_next_expand()` | Nodes that will be added next expand |
| `dmr_get_nodes_next_shrink()` | Nodes that will be removed next shrink |
| `dmr_get_last_action()` | Last `DMRAction` returned by any DMR function |
