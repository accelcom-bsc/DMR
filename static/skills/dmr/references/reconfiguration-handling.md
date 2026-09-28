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

## In-memory transfer via DMR_INTERCOMM

With `DMR_CHECKPOINT_RESTART=0` (set when DMR is built), the state travels over an intercommunicator (`DMR_INTERCOMM`) instead of through files. The processes are relaunched exactly as in checkpoint-restart mode — that does not change — but the outgoing and incoming worlds coexist briefly and exchange data directly.

The mapping is the part to get right. A rank of the incoming world generally overlaps several ranks of the outgoing one, so a fixed `dest_rank` only works when the counts divide evenly:

```c
// redist_func: send each incoming rank the part of my block it now owns
void send_data(void) {
    int new_size;
    MPI_Comm_remote_size(DMR_INTERCOMM, &new_size);
    for (int dst = 0; dst < new_size; dst++) {
        int d0, d1;
        block_of(dst, new_size, &d0, &d1);      // same function on both sides
        int lo = max(my_start, d0), hi = min(my_end, d1);
        if (hi >= lo)
            MPI_Send(&local[lo - my_start], hi - lo + 1, MPI_DOUBLE, dst, 0, DMR_INTERCOMM);
    }
}

// restart_func: mirror image, over the ranks of the outgoing world
void recv_data(void) {
    int old_size;
    MPI_Comm_remote_size(DMR_INTERCOMM, &old_size);
    for (int src = 0; src < old_size; src++) {
        int s0, s1;
        block_of(src, old_size, &s0, &s1);
        int lo = max(my_start, s0), hi = min(my_end, s1);
        if (hi >= lo)
            MPI_Recv(&local[lo - my_start], hi - lo + 1, MPI_DOUBLE, src, 0, DMR_INTERCOMM, MPI_STATUS_IGNORE);
    }
}
```

`block_of` must reproduce the application's own partitioning, rounding included: each side derives the other's blocks from it without communicating, so any disagreement loses or duplicates data silently.

Use this mode when checkpoint I/O latency is prohibitive, or when there is no existing checkpointing to reuse.
See [Data Redistribution](https://iarejula-bsc.github.io/dmr_doc/user-guide/data-redistribution) for redistribution patterns across a rank count change.
