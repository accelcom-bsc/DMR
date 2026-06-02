---
title: Policy Context Reference
description: Complete reference for the DMRPolicyContext struct.
---

`DMRPolicyContext` is passed to the `run` callback of every policy. All fields are **read-only**.

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `current_nodes` | `int` | Number of nodes in the current `MPI_COMM_WORLD` |
| `reconfig_count` | `int` | Number of reconfigurations that have occurred since `dmr_init` |
| `min_nodes` | `int` | Policy minimum nodes |
| `max_nodes` | `int` | Policy maximum nodes |
| `nodes_in_expand` | `int` | Nodes that will be requested in the next expand |
| `nodes_in_shrink` | `int` | Nodes that will be released in the next shrink |
| `procs_in_expand` | `int` | Processes that will be spawned in the next expand |
| `procs_in_shrink` | `int` | Processes that will exit in the next shrink |
| `stride` | `int` | Legacy stride value; new policies should carry stride in their own state |
| `pref_nodes` | `int` | Preferred node count passed into policy configuration |
| `internal_dmr_state` | `void *` | Opaque pointer to `DMRState`; for advanced use only |
| `internal_controller_state` | `void *` | Opaque pointer to `DMRControllerState`; for advanced use only |

## Notes

- `reconfig_count` starts at `0` and increments by 1 after each successful reconfiguration.
- `min_nodes` and `max_nodes` reflect the values passed to the active policy's configuration, not global compile-time limits.
- `internal_dmr_state` and `internal_controller_state` expose implementation internals and may change between releases. Avoid using them in portable code.
