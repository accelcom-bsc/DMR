---
title: Application Structure
description: How a DMR application is organized around the main loop.
---

A DMR application follows a straightforward structure built around three lifecycle functions and a main loop.

## Lifecycle overview

```
MPI_Init
  └─ dmr_init          ← initialize DMR state and connect to Slurm
       └─ [ main loop ]
            └─ dmr_check    ← evaluate policy, trigger reconfiguration if needed
       └─ dmr_finalize  ← clean up DMR state
MPI_Finalize
```

## dmr_init

Call `dmr_init` immediately after `MPI_Init`, passing the same `argc` and `argv`:

```c
MPI_Init(&argc, &argv);
DMR_AUTO(dmr_init(argc, argv), expand_cb(), shrink_cb(), exit_cb());
```

`dmr_init` is a **collective** operation — all MPI ranks must call it.

## The main loop

The main loop is the heart of a DMR application. On each iteration:

1. Call `dmr_check` to let DMR evaluate whether a reconfiguration should happen.
2. If a reconfiguration occurs, DMR invokes your callbacks and adjusts `MPI_COMM_WORLD`.
3. Continue with your computation using the updated communicator.

```c
while (should_keep_running()) {
    DMR_AUTO(dmr_check(USE_POLICY), expand_cb(), shrink_cb(), exit_cb());
    do_work();
}
```

## dmr_finalize

Call `dmr_finalize` after the main loop and before `MPI_Finalize`:

```c
DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, exit_cb());
MPI_Finalize();
```

`dmr_finalize` is also **collective**.

## Communicator validity

After a reconfiguration, `MPI_COMM_WORLD` refers to the **new** set of processes. Any cached communicators, derived datatypes, or MPI windows that depend on the old communicator must be freed in the shrink callback and recreated in the expand callback.

## Thread safety

DMR is **not thread-safe**. Do not call `dmr_check` or `dmr_set_policy` from multiple threads concurrently.
