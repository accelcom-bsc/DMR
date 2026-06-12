# Reconfiguration Handling

Full online docs: https://iarejula-bsc.github.io/dmr_doc/user-guide/reconfiguration-handling

## DMR_AUTO dispatch table

`DMR_AUTO` inspects the `DMRAction` returned by a DMR function and calls the appropriate callback:

| DMRAction | What DMR_AUTO does |
|---|---|
| `DMR_NO_ACTION` | Nothing — execution continues normally |
| `DMR_RECONF` | Calls `dmr_reconfigure()` internally. If that returns `DMR_REDIST_FINALIZE`, calls `redist_func` + `finalize_func` and exits this rank |
| `DMR_RESTART_RECONF` | Calls `restart_func` (to restore state), then `dmr_reconfigure()` |
| `DMR_REDIST_FINALIZE` | Calls `redist_func` + `finalize_func`, then `dmr_finalize()` — rank exits |
| `DMR_FINALIZE` | Calls `finalize_func`, then `dmr_finalize()` — rank exits |
| `DMR_CLEANUP` | Calls `finalize_func` only — rank does not exit |
| `DMR_ERROR` | Does nothing |

## Callback roles

```c
DMR_AUTO(action_call, redist_func, restart_func, finalize_func)
```

| Callback | When called | Responsibility |
|---|---|---|
| `redist_func` | On `dmr_check` when this rank is about to exit | **Save** application state to disk (or send via `DMR_INTERCOMM`) |
| `restart_func` | On `dmr_init` when restarting after reconfiguration | **Load** application state from disk |
| `finalize_func` | When any rank is terminating | **Free** memory, close file handles |

Pass `(void)NULL` for any callback not needed — never omit a parameter.

## Typical wiring

```c
// dmr_init: restore state if this is a post-reconfiguration restart
DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), cleanup());

// dmr_check: save state on ranks that are about to exit
DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());

// dmr_finalize: cleanup only, no data transfer
DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
```

## Implementing the callbacks

### redist_func — save state before a rank exits

```c
void save(void) {
    FILE *f = fopen("checkpoint.bin", "wb");
    fwrite(&my_state, sizeof(my_state), 1, f);
    fclose(f);
}
```

The checkpoint must be **rank-agnostic**: the new process count is different, so files indexed by rank (e.g. `ckpt_rank_%d.bin`) will fail to load. Key files by global data offset instead.

### restart_func — restore state after restart

```c
void load(void) {
    FILE *f = fopen("checkpoint.bin", "rb");
    fread(&my_state, sizeof(my_state), 1, f);
    fclose(f);
}
```

`DMR_AUTO` only calls `restart_func` when `dmr_init` returns `DMR_RESTART_RECONF` (i.e. this is a post-reconfiguration restart), so no guard for the first launch is needed inside `load()`.

### finalize_func — release resources

```c
void cleanup(void) {
    free(my_data);
    // close file handles, MPI windows, etc.
}
```

## Without the macro

If `DMR_AUTO` does not fit your control flow, dispatch manually:

```c
DMRAction action = dmr_check(ROUND_POLICY);
if (action == DMR_RECONF) {
    if (dmr_reconfigure() == DMR_REDIST_FINALIZE) {
        save();
        cleanup();
        dmr_finalize();
        exit(0);
    }
} else if (action == DMR_RESTART_RECONF) {
    load();
    dmr_reconfigure();
}
```

## Alternative: in-memory transfer via DMR_INTERCOMM

With `DMR_CHECKPOINT_RESTART=0` (set at compile time), DMR does not restart the process — instead it uses an intercommunicator (`DMR_INTERCOMM`) to transfer data directly between old and new ranks without writing to disk.

```c
// redist_func: send data to new ranks via DMR_INTERCOMM
void send_data(void) {
    MPI_Send(my_array, local_n, MPI_DOUBLE, dest_rank, 0, DMR_INTERCOMM);
}

// restart_func: receive data from old ranks via DMR_INTERCOMM
void recv_data(void) {
    MPI_Recv(my_array, local_n, MPI_DOUBLE, src_rank, 0, DMR_INTERCOMM, MPI_STATUS_IGNORE);
}
```

Use this mode when checkpoint I/O latency is prohibitive and in-memory transfer is feasible.
See [Data Redistribution](https://iarejula-bsc.github.io/dmr_doc/user-guide/data-redistribution) for redistribution patterns across a rank count change.
