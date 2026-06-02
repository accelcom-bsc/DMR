---
sidebar_position: 2
title: Reconfiguration Handling
---

`DMR_AUTO` dispatches to the right callback based on the `DMRAction` returned by a DMR function.

## DMR_AUTO signature

```c
DMR_AUTO(the_action, redist_func, restart_func, finalize_func)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `the_action` | `DMRAction` | Return value of `dmr_init`, `dmr_check`, or `dmr_finalize` |
| `redist_func` | expression | Called when data must be **saved** before this rank exits |
| `restart_func` | expression | Called when data must be **restored** after a restart |
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
| `DMR_ERROR` | Does nothing |


## Usage examples

```c
// dmr_init: load state if restarting
DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), cleanup());

// dmr_check: save state on ranks that are about to exit
DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());

// dmr_finalize: cleanup only
DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
```

Pass `(void)NULL` for any callback you do not need.
## Implementing the callbacks

### redist_func: save state before exiting

Called on ranks that are about to exit during a reconfiguration. Write application state to disk so the new process configuration can restore it.

```c
void save(void)
{
    FILE *f = fopen("checkpoint.bin", "wb");
    fwrite(&my_state, sizeof(my_state), 1, f);
    fclose(f);
}
```

With `DMR_CHECKPOINT_RESTART=0`, send data directly via `DMR_INTERCOMM` instead of writing to disk. See [Data Redistribution](data-redistribution) for details.

### restart_func: restore state after restart

Called on processes restarting after a reconfiguration. Read the state written by `redist_func`.

```c
void load(void)
{
    FILE *f = fopen("checkpoint.bin", "rb");
    fread(&my_state, sizeof(my_state), 1, f);
    fclose(f);
}
```

`DMR_AUTO` only calls `restart_func` when `dmr_init` returns `DMR_RESTART_RECONF`, so no guard for first launch is needed.

### finalize_func: clean up resources

Called on any rank that is about to terminate. Free memory, close file handles, etc.

```c
void cleanup(void)
{
    free(my_data);
}
```

## Without the macro

```c
DMRAction action = dmr_check(ROUND_POLICY);
if (action == DMR_RECONF) {
    if (dmr_reconfigure() == DMR_REDIST_FINALIZE) {
        save();
        cleanup();
        dmr_finalize();
    }
} else if (action == DMR_RESTART_RECONF) {
    load();
    dmr_reconfigure();
}
```
