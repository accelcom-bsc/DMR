---
sidebar_position: 6
title: Data Redistribution
---

When a reconfiguration happens, all processes exit and the executable restarts from scratch with the new process count. Before exiting, the old processes must transfer their state to the new ones so the application can resume correctly.

DMR supports two ways to do this, selected at compile time with `DMR_CHECKPOINT_RESTART`.

## Checkpoint-restart (default)

`DMR_CHECKPOINT_RESTART=1`

Old processes write their state to disk (`redist_func`), then exit. New processes start from the beginning of the executable and read that state back (`restart_func`).

```mermaid
sequenceDiagram
    participant Old as Old processes
    participant Disk
    participant New as New processes
    destroy Old
    Old->>Disk: redist_func() — save state
    Note over New: main() starts
    New->>Disk: restart_func() — load state
    Note over New: continue...
```

Use this mode when you already have checkpoint logic in your application, or when your system does not support the custom PRRTE version required for intercommunicator mode.

## Intercommunicator

`DMR_CHECKPOINT_RESTART=0`

Old and new processes are **alive at the same time** for a short window. DMR exposes `DMR_INTERCOMM`, an MPI intercommunicator connecting both sets of processes so they can exchange data directly. Once the transfer is done, the old processes exit. New processes also start from the beginning of the executable.

```mermaid
sequenceDiagram
    participant Old as Old processes
    participant New as New processes
    Note over New: main() starts
    par Both alive simultaneously
        Note over Old: redist_func()
        Note over New: restart_func()
        destroy Old
        Old->>New: send / recv via DMR_INTERCOMM
    end
    Note over New: continue...
```

Use `dmr_intercomm_available()` to check whether `DMR_INTERCOMM` is currently valid before using it.

:::note[The whole world is replaced, no surviving ranks]
A reconfiguration is an **MPI spawn of a brand-new world** (`MPI_Comm_spawn_multiple`) plus a relaunch of the executable from `main()`; every process of the old world then exits. This holds on both a shrink and an expand, so **no rank keeps data across the boundary** — every new process must obtain everything it needs over `DMR_INTERCOMM`. There is no "surviving rank that already holds part of the array."
:::

### The two worlds and `DMR_INTERCOMM`

`DMR_INTERCOMM` connects the two worlds as the local/remote groups of one MPI intercommunicator:

| Side | Local group | Remote group |
|------|-------------|--------------|
| Leaving (old) world | the old `MPI_COMM_WORLD` (size = old N) | the new world (size = new M) |
| Spawned (new) world | the new `MPI_COMM_WORLD` (size = new M) | the old world (size = old N) |

So `MPI_Comm_size(MPI_COMM_WORLD, ...)` gives your own world's size, and `MPI_Comm_remote_size(DMR_INTERCOMM, ...)` gives the *other* world's size. Remote ranks are numbered `0 .. remote_size-1`, and you send to / receive from them by that rank number over `DMR_INTERCOMM` (it is a normal MPI intercommunicator).

### When is `DMR_INTERCOMM` valid?

The intercommunicator only exists during the reconfigure window, and the window is different on each side. Each side must do its transfer inside the matching `DMR_AUTO` callback:

| Side | Valid from | Until | Transfer goes in |
|------|-----------|-------|------------------|
| Leaving (old) ranks | `dmr_reconfigure()` returns `DMR_REDIST_FINALIZE` | `dmr_finalize()` (frees it, then the rank exits) | **`redist_func`** (send) |
| Spawned (new) ranks | `dmr_init()` returns `DMR_RESTART_RECONF` | `dmr_reconfigure()` (frees it) | **`restart_func`** (receive) |

`DMR_AUTO` already sequences these correctly: on the leaving side it calls `dmr_reconfigure()` (which spawns the new world and creates the intercomm) *before* `redist_func`; on the spawned side it calls `restart_func` *before* `dmr_reconfigure()` (which frees the intercomm). The intercommunicator is **not** valid after `dmr_check`/`dmr_init` return in the steady state — `dmr_intercomm_available()` returns 0 there.

### Worked example: redistributing a block-distributed array

The array is split into contiguous blocks, one per rank. After a reconfiguration the number of ranks changes, so the block boundaries move and data must be re-sent. The same code handles both shrink (many → few) and expand (few → many): each old rank sends the slices that overlap each new rank's block, and each new rank receives the slices that overlap its block from each old rank.

```c
#include <mpi.h>
#include "dmr.h"

#define GLOBAL_N 1000000          /* total elements, fixed across reconfigurations */

static double *local = NULL;      /* this rank's block */
static int local_start, local_count;

/* Contiguous block owned by `rank` out of `size` ranks. */
static void block_range(int rank, int size, int n, int *start, int *count)
{
    int base = n / size, rem = n % size;
    *start = rank * base + (rank < rem ? rank : rem);
    *count = base + (rank < rem ? 1 : 0);
}

static inline int imax(int a, int b) { return a > b ? a : b; }
static inline int imin(int a, int b) { return a < b ? a : b; }
```

#### Sending side — `redist_func` on the leaving ranks

```c
/* Called on every old rank once dmr_reconfigure() has created the intercomm. */
static void send_state(void)
{
    int old_size, my_rank, new_size;
    MPI_Comm_size(MPI_COMM_WORLD, &old_size);
    MPI_Comm_rank(MPI_COMM_WORLD, &my_rank);
    MPI_Comm_remote_size(DMR_INTERCOMM, &new_size);   /* size of the new world */

    block_range(my_rank, old_size, GLOBAL_N, &local_start, &local_count);

    /* Send each new rank only the part of my block that lands in its block. */
    for (int dst = 0; dst < new_size; dst++) {
        int d_start, d_count;
        block_range(dst, new_size, GLOBAL_N, &d_start, &d_count);

        int lo = imax(local_start, d_start);
        int hi = imin(local_start + local_count, d_start + d_count);
        if (hi > lo) {
            MPI_Send(&local[lo - local_start], hi - lo, MPI_DOUBLE,
                     dst, 0, DMR_INTERCOMM);
        }
    }
    free(local);
    local = NULL;
}
```

#### Receiving side — `restart_func` on the spawned ranks

```c
/* Called on every new rank before it calls dmr_reconfigure(). */
static void recv_state(void)
{
    int new_size, my_rank, old_size;
    MPI_Comm_size(MPI_COMM_WORLD, &new_size);
    MPI_Comm_rank(MPI_COMM_WORLD, &my_rank);
    MPI_Comm_remote_size(DMR_INTERCOMM, &old_size);   /* size of the old world */

    block_range(my_rank, new_size, GLOBAL_N, &local_start, &local_count);
    local = malloc(local_count * sizeof(double));

    /* Receive from each old rank whose block overlaps mine. */
    for (int src = 0; src < old_size; src++) {
        int s_start, s_count;
        block_range(src, old_size, GLOBAL_N, &s_start, &s_count);

        int lo = imax(local_start, s_start);
        int hi = imin(local_start + local_count, s_start + s_count);
        if (hi > lo) {
            MPI_Recv(&local[lo - local_start], hi - lo, MPI_DOUBLE,
                     src, 0, DMR_INTERCOMM, MPI_STATUS_IGNORE);
        }
    }
}
```

#### Wiring it into the main loop

```c
int main(int argc, char *argv[])
{
    MPI_Init(&argc, &argv);

    /* On a spawned rank, dmr_init returns DMR_RESTART_RECONF and DMR_AUTO
       runs recv_state() (intercomm still valid) before dmr_reconfigure(). */
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, recv_state(), (void)NULL);

    /* First launch only: allocate and fill the initial block. */
    if (dmr_get_reconfig_count() == 0 && local == NULL) {
        int size, rank;
        MPI_Comm_size(MPI_COMM_WORLD, &size);
        MPI_Comm_rank(MPI_COMM_WORLD, &rank);
        block_range(rank, size, GLOBAL_N, &local_start, &local_count);
        local = malloc(local_count * sizeof(double));
        /* ... initialize local[] ... */
    }

    while (work_remaining()) {
        /* On a leaving rank, dmr_reconfigure() (called inside DMR_AUTO) spawns
           the new world, then DMR_AUTO runs send_state() while the intercomm
           is valid, then finalizes and exits the rank. */
        DMR_AUTO(dmr_check(ROUND_POLICY), send_state(), (void)NULL, (void)NULL);
        do_work(local, local_count);
    }

    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, (void)NULL);
    MPI_Finalize();
    return 0;
}
```

:::note[Expand vs shrink]
The send/receive loops above are symmetric and need no special-casing: on a **shrink** (`old_size > new_size`) each new rank's block is larger, so it receives slices from several old ranks (a gather); on an **expand** (`old_size < new_size`) each old rank's block is larger, so it sends slices to several new ranks (a scatter). Because the whole world is replaced, every new rank rebuilds its block entirely from the intercomm — nothing is reused in place.
:::

### Carrying the resume point without a disk checkpoint

In checkpoint-restart mode the loop index is usually restored from the same file as the data (see [Application Structure](app-structure)). In intercommunicator mode there is no file, so send the resume index over `DMR_INTERCOMM` alongside the array — e.g. have old rank 0 `MPI_Send` it to new rank 0 in `send_state`, and have new rank 0 `MPI_Recv` it in `recv_state` and broadcast it over the new `MPI_COMM_WORLD`.

`dmr_get_reconfig_count()` only tells you *how many times* the job has reconfigured since launch — it is not a work-progress counter, so do not use it as the resume index unless your iteration count happens to equal the reconfiguration count.
