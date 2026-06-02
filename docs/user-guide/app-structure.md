---
sidebar_position: 1
title: Application Structure
---

A DMR application is built around three lifecycle functions and a main loop. The central concept is that DMR returns a `DMRAction` value telling you what to do next, and `DMR_AUTO` handles the dispatch automatically.

## Lifecycle overview

```
MPI_Init
  └─ dmr_init       ← initialize DMR; may return DMR_RESTART_RECONF on a restarted process
       └─ [ main loop ]
            └─ dmr_check   ← suggest a policy; returns DMR_RECONF when ready to reconfigure
            └─ dmr_reconfigure (called automatically by DMR_AUTO)
       └─ dmr_finalize
MPI_Finalize
```

## Typical main loop

```c
#include <mpi.h>
#include "dmr.h"

static void save_checkpoint(void)  { /* write data to disk or send via DMR_INTERCOMM */ }
static void load_checkpoint(void)  { /* read data written by previous configuration */ }
static void cleanup(void)          { /* free resources */ }

int main(int argc, char *argv[])
{
    MPI_Init(&argc, &argv);

    /* dmr_init may return DMR_RESTART_RECONF if this process was spawned
       as part of an expansion — load_checkpoint() handles that case. */
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, load_checkpoint(), cleanup());

    dmr_set_policy_min_nodes(2);
    dmr_set_policy_max_nodes(8);

    while (should_keep_running()) {
        DMR_AUTO(dmr_check(ROUND_POLICY), save_checkpoint(), (void)NULL, cleanup());
        do_work();
    }

    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
    MPI_Finalize();
    return 0;
}
```

## dmr_init

Call `dmr_init` immediately after `MPI_Init`. **Collective.**

On first launch it returns `DMR_NO_ACTION`. When a process is restarted after a reconfiguration it may return `DMR_RESTART_RECONF`, which triggers the `restart_func` argument in `DMR_AUTO`.

Use `dmr_get_reconfig_count()` to tell apart first launch from a restart:

```c
void load_checkpoint(void)
{
    if (dmr_get_reconfig_count() == 0) return;  // first launch, nothing to load
    // ... read checkpoint written by the previous configuration
}
```

## dmr_check

Call `dmr_check` inside the main loop with a `DMRSuggestion`. **Collective.**

When DMR decides to reconfigure it returns `DMR_RECONF`. `DMR_AUTO` then calls `dmr_reconfigure()` internally, which handles the MPI communicator setup. The leaving processes receive `DMR_REDIST_FINALIZE` from `dmr_reconfigure()` — `DMR_AUTO` calls `redist_func` and `finalize_func` on them and terminates those ranks.

## dmr_reconfigure

Called automatically by `DMR_AUTO` when `DMR_RECONF` is returned. Do not call it manually unless you handle `DMRAction` values yourself.

## dmr_finalize

Call `dmr_finalize` after the main loop and before `MPI_Finalize`. **Collective.**

## Communicator and checkpoint-restart

DMR supports two redistribution strategies, selected at compile time:

| Strategy | `DMR_CHECKPOINT_RESTART` | How it works |
|----------|--------------------------|--------------|
| **Checkpoint-restart** (default) | `1` | Processes write data before reconfiguring; new processes read it on restart via `restart_func` |
| **Intercommunicator** | `0` | DMR exposes `DMR_INTERCOMM` so old and new processes exchange data directly via MPI |

When using the intercommunicator, check `dmr_intercomm_available()` before using `DMR_INTERCOMM`.

## Thread safety

DMR is **not thread-safe**. Do not call any DMR function from multiple threads concurrently.
