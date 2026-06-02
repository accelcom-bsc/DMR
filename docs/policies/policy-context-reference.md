---
sidebar_position: 4
title: Runtime State Reference
---

These read-only functions expose the current DMR state. Use them inside your application logic or custom policy code.

## Node and process counts

| Function | Description |
|----------|-------------|
| `dmr_get_current_node_count()` | Nodes in the current `MPI_COMM_WORLD` |
| `dmr_get_nodes_next_expand()` | Nodes that will be added in the next expand |
| `dmr_get_nodes_next_shrink()` | Nodes that will be removed in the next shrink |
| `dmr_get_procs_next_expand()` | Processes that will be spawned in the next expand |
| `dmr_get_procs_next_shrink()` | Processes that will exit in the next shrink |

## Reconfiguration state

| Function | Description |
|----------|-------------|
| `dmr_get_reconfig_count()` | Reconfigurations since original launch (0 = first run) |
| `dmr_get_active_expansions()` | Number of expansion jobs currently active |
| `dmr_pending_expansion()` | `1` if an expansion job is pending, `0` otherwise |
| `dmr_get_last_action()` | Last `DMRAction` returned by any DMR function |
| `dmr_intercomm_available()` | `1` if `DMR_INTERCOMM` is currently usable |

## DMR_INTERCOMM

```c
extern MPI_Comm DMR_INTERCOMM;
```

When `DMR_CHECKPOINT_RESTART=0`, this intercommunicator connects the old and new process sets during a reconfiguration. Only valid when `dmr_intercomm_available()` returns `1`.

Use it in `redist_func` and `restart_func` to exchange data directly between configurations.
