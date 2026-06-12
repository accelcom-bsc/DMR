# Advanced Usage — Applications with Pre-existing Checkpoint/Restart

This file covers cases where `DMR_AUTO` does not fit cleanly, typically large
scientific applications (e.g. Alya, GROMACS) that already have their own
checkpoint/restart mechanism triggered through their own shutdown path rather than
as standalone callable functions.

## When DMR_AUTO gets in the way

`DMR_AUTO` expects three standalone callback expressions:

```c
DMR_AUTO(dmr_check(USE_POLICY), redist_func(), restart_func(), finalize_func());
```

This works well when `redist_func` and `restart_func` are clean, self-contained
functions. It breaks down when:

- The application's CR is triggered by a signal handler, `atexit`, or `MPI_Finalize` hook
- The CR logic calls `exit()` or `MPI_Finalize()` internally
- Save and load are entangled with other shutdown steps that must not run during a DMR reconfiguration
- The framework owns the restart path (the process does not re-enter from `main()`)

## Option 1 — Re-package the existing CR into DMR-compatible functions

The cleanest solution when the existing CR logic can be extracted. Create two thin
wrappers that call only the save/load part, without the surrounding shutdown logic:

```c
// Existing application code (do not modify)
void app_checkpoint_and_exit(void) {
    write_hdf5_restart();
    close_all_files();
    MPI_Finalize();   // <-- problem: this conflicts with DMR_AUTO's own rank exit
    exit(0);
}

// New wrapper for DMR — save only, no termination
void dmr_save(void) {
    write_hdf5_restart();  // call the save part directly
    // do NOT call MPI_Finalize or exit here
}

// New wrapper for DMR — load only
void dmr_load(void) {
    read_hdf5_restart();
}

DMR_AUTO(dmr_check(USE_POLICY), dmr_save(), (void)NULL, close_all_files());
DMR_AUTO(dmr_init(argc, argv),  (void)NULL,  dmr_load(), close_all_files());
```

This is the preferred path when feasible — it keeps the DMR integration minimal and
leaves the existing CR logic untouched.

## Option 2 — Manual dispatch without DMR_AUTO

When re-packaging is not feasible, dispatch manually. This gives full control over
what happens at each DMRAction, without `DMR_AUTO` imposing its own call sequence:

```c
DMRAction action = dmr_check(USE_POLICY);

if (action == DMR_RECONF) {
    // trigger the application's own save mechanism here
    app_save_state();

    action = dmr_reconfigure();

    if (action == DMR_REDIST_FINALIZE) {
        // this rank is leaving — run whatever cleanup the app needs
        app_cleanup();
        dmr_finalize();
        exit(0);  // or MPI_Finalize + exit, matching what the app normally does
    }

} else if (action == DMR_RESTART_RECONF) {
    // post-reconfiguration restart — load state using the app's own mechanism
    app_load_state();
    dmr_reconfigure();
}
```

The full dispatch table (including `DMR_FINALIZE`, `DMR_CLEANUP`, `DMR_ERROR`) is
in [reconfiguration-handling.md](reconfiguration-handling.md).

## Option 3 — In-memory transfer via DMR_INTERCOMM (no checkpoint files)

With `DMR_CHECKPOINT_RESTART=0` at compile time, DMR uses an intercommunicator
(`DMR_INTERCOMM`) to transfer data directly between old and new ranks. This avoids
the checkpoint file entirely and is useful when:

- The application's restart path assumes reading from disk but the data transfer cost is acceptable in memory
- The existing CR format is incompatible with a different rank count (rank-indexed files)

```c
// redist_func: send data to new ranks
void send_to_new_ranks(void) {
    MPI_Send(my_data, local_n, MPI_DOUBLE, dest, 0, DMR_INTERCOMM);
}

// restart_func: receive data from old ranks
void recv_from_old_ranks(void) {
    MPI_Recv(my_data, local_n, MPI_DOUBLE, src, 0, DMR_INTERCOMM, MPI_STATUS_IGNORE);
}
```

See [Data Redistribution](https://iarejula-bsc.github.io/dmr_doc/user-guide/data-redistribution)
for redistribution patterns when the rank count changes.

## Deciding which option to use

Discuss with the developer before choosing:

| Situation | Recommended option |
|---|---|
| Existing CR is a callable function with no self-termination | Re-package (Option 1) |
| CR is entangled with shutdown, signals, or framework lifecycle | Manual dispatch (Option 2) |
| Checkpoint files are rank-indexed or disk I/O is the bottleneck | In-memory transfer (Option 3) |
| Unsure — need to understand the app first | Ask the developer (see Phase 1e) |
