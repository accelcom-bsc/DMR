---
sidebar_position: 2
title: The DMR_AUTO Macro
---

`DMR_AUTO` dispatches to the right callback based on the `DMRAction` returned by a DMR function.

## Signature

```c
DMR_AUTO(the_action, redist_func, restart_func, finalize_func)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `the_action` | `DMRAction` | Return value of `dmr_init`, `dmr_check`, or `dmr_finalize` |
| `redist_func` | expression | Called when data must be **saved/redistributed** (checkpoint or intercomm send) |
| `restart_func` | expression | Called when data must be **restored** (process restarting after reconfiguration) |
| `finalize_func` | expression | Called for **cleanup** before a rank exits |

## Dispatch table

| DMRAction | What DMR_AUTO does |
|-----------|--------------------|
| `DMR_NO_ACTION` | Nothing |
| `DMR_RECONF` | Calls `dmr_reconfigure()`. If that returns `DMR_REDIST_FINALIZE`, calls `redist_func`, `finalize_func`, then `dmr_finalize()` (rank exits) |
| `DMR_RESTART_RECONF` | Calls `restart_func`, then `dmr_reconfigure()` |
| `DMR_REDIST_FINALIZE` | Calls `redist_func`, `finalize_func`, then `dmr_finalize()` (rank exits) |
| `DMR_FINALIZE` | Calls `finalize_func`, then `dmr_finalize()` (rank exits) |
| `DMR_CLEANUP` | Calls `finalize_func` |
| `DMR_ERROR` | Does nothing (handle errors yourself if needed) |

## Examples

### Init — checkpoint-restart pattern

```c
// On restart after reconfiguration, load_checkpoint() reads the saved state.
DMR_AUTO(dmr_init(argc, argv), (void)NULL, load_checkpoint(), cleanup());
```

### Check — checkpoint-restart pattern

```c
// save_checkpoint() is called on ranks that are about to exit.
DMR_AUTO(dmr_check(ROUND_POLICY), save_checkpoint(), (void)NULL, cleanup());
```

### Check — intercommunicator pattern

```c
// With DMR_CHECKPOINT_RESTART=0, use DMR_INTERCOMM to send data directly.
DMR_AUTO(dmr_check(ROUND_POLICY), send_via_intercomm(), recv_via_intercomm(), cleanup());
```

### Finalize

```c
DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
```

## Using (void)NULL

Pass `(void)NULL` for any callback you don't need.

## Without the macro

```c
DMRAction action = dmr_check(ROUND_POLICY);
if (action == DMR_RECONF) {
    if (dmr_reconfigure() == DMR_REDIST_FINALIZE) {
        save_checkpoint();
        cleanup();
        dmr_finalize();
    }
} else if (action == DMR_RESTART_RECONF) {
    load_checkpoint();
    dmr_reconfigure();
}
```
