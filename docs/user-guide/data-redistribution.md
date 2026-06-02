---
sidebar_position: 7
title: Data Redistribution
---

When a reconfiguration happens, all processes exit and the executable restarts from scratch with the new process count. Before exiting, the old processes must transfer their state to the new ones so the application can resume correctly.

DMR supports two ways to do this, selected at compile time with `DMR_CHECKPOINT_RESTART`.

## Checkpoint-restart (default)

`DMR_CHECKPOINT_RESTART=1`

Old processes write their state to disk (`redist_func`), then exit. New processes start from the beginning of the executable and read that state back (`restart_func`).

```
old processes          new processes
      │                      │
  redist_func()              │  ← save state to disk
      │                      │
    exit                     │
                         main() starts
                         restart_func() ← load state from disk
                             │
                         continue...
```

Use this mode when you already have checkpoint logic in your application, or when your system does not support the custom PRRTE version required for intercommunicator mode.

## Intercommunicator

`DMR_CHECKPOINT_RESTART=0`

Old and new processes are **alive at the same time** for a short window. DMR exposes `DMR_INTERCOMM`, an MPI intercommunicator connecting both sets of processes so they can exchange data directly. Once the transfer is done, the old processes exit. New processes also start from the beginning of the executable.

```
old processes          new processes
      │                      │
  redist_func()          main() starts  ← both alive simultaneously
  send via INTERCOMM     restart_func()
      │                  recv via INTERCOMM
    exit                     │
                         continue...
```

Use `dmr_intercomm_available()` to check whether `DMR_INTERCOMM` is currently valid before using it.

:::note[Work in progress]
Detailed usage examples for intercommunicator mode are coming soon.
:::
