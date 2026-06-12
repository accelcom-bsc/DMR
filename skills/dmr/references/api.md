# DMR API Reference

Full online docs: https://iarejula-bsc.github.io/dmr_doc/api/core-api

## Core functions

```c
#include "dmr.h"

// Collective. Call immediately after MPI_Init.
// Returns DMR_NO_ACTION on first launch, DMR_RESTART_RECONF after a reconfiguration restart.
DMRAction dmr_init(int argc, char **argv);

// Collective. Call at each safe synchronisation point inside the main loop or at stage boundaries.
// Evaluates the active policy and triggers a reconfiguration if warranted.
DMRAction dmr_check(DMRSuggestion suggestion);

// Not collective. Call before MPI_Finalize. No DMR calls may follow.
DMRAction dmr_finalize(void);
```

## DMR_AUTO macro

`DMR_AUTO` is the primary dispatch mechanism. It calls a DMR function, inspects
the returned `DMRAction`, and invokes the appropriate callback. **Always use
`DMR_AUTO` instead of calling DMR functions directly** — do not call
`dmr_reconfigure()` manually.

```c
DMR_AUTO(action_call, redist_func, restart_func, finalize_func)
//       ^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//       the full DMR  three callbacks — one for each possible
//       function call  non-trivial DMRAction value
```

`action_call` is the **entire DMR function call expression**, not a stored return value:

```c
// CORRECT — pass the call itself
DMR_AUTO(dmr_init(argc, argv),  (void)NULL,       load_checkpoint(), cleanup());
DMR_AUTO(dmr_check(USE_POLICY), save_checkpoint(), (void)NULL,        cleanup());
DMR_AUTO(dmr_finalize(),        (void)NULL,        (void)NULL,        cleanup());

// WRONG — do not call separately and pass the result
DMRAction a = dmr_init(argc, argv);
DMR_AUTO(a, ...);  // incorrect usage
```

**What DMR_AUTO does internally for each DMRAction:**

| DMRAction returned | What DMR_AUTO does |
|---|---|
| `DMR_NO_ACTION` | Nothing — continues execution normally |
| `DMR_RESTART_RECONF` | Calls `restart_func`, then continues |
| `DMR_RECONF` | Calls `dmr_reconfigure()` internally; leaving ranks get `DMR_REDIST_FINALIZE` and DMR_AUTO calls `redist_func` + `finalize_func` on them and exits those ranks; surviving ranks continue |
| `DMR_REDIST_FINALIZE` | Calls `redist_func` then `finalize_func` on this rank and terminates it |

**The three callbacks and when each is needed:**

```c
DMR_AUTO(action_call, redist_func, restart_func, finalize_func)
//                    ^^^^^^^^^^^  ^^^^^^^^^^^^  ^^^^^^^^^^^^^
//                    called on    called on      called when
//                    dmr_check    dmr_init when  this rank is
//                    when reconf  restarting     leaving the
//                    fires: SAVE  after reconf:  job: FREE
//                    state        LOAD state     resources
```

Typical wiring for each of the three DMR calls:

```c
// dmr_init: only restart_func matters — this is where you load state on restart
DMR_AUTO(dmr_init(argc, argv),   (void)NULL,        load_checkpoint(), cleanup());

// dmr_check: only redist_func matters — this is where you save state before reconfiguring
DMR_AUTO(dmr_check(USE_POLICY),  save_checkpoint(), (void)NULL,        cleanup());

// dmr_finalize: no data callbacks needed, just cleanup
DMR_AUTO(dmr_finalize(),         (void)NULL,        (void)NULL,        cleanup());
```

Pass `(void)NULL` for any callback not needed — never omit a parameter.

## DMRSuggestion — passed to `dmr_check`

| Value | Behaviour |
|---|---|
| `USE_POLICY` | Let the active built-in policy decide |
| `SHOULD_EXPAND` | Hint: request more nodes |
| `SHOULD_SHRINK` | Hint: release nodes |
| `ROUND_POLICY` | Alternate expand / shrink each call |

## DMRAction — returned by all three core functions

| Value | Meaning |
|---|---|
| `DMR_NO_ACTION` | Nothing to do, continue normally |
| `DMR_RESTART_RECONF` | This is a post-reconfiguration restart — `DMR_AUTO` calls `restart_func` |
| `DMR_RECONF` | Reconfiguration triggered — `DMR_AUTO` calls `dmr_reconfigure()` internally |
| `DMR_REDIST_FINALIZE` | This rank is leaving — `DMR_AUTO` calls `redist_func` then `finalize_func` and exits |

## Policy setters and state queries

For policy configuration (min/max nodes, stride, inhibitor, sizing per expand/shrink)
and state queries (`dmr_get_current_node_count`, etc.) see [policies.md](policies.md).

Full policy API: https://iarejula-bsc.github.io/dmr_doc/api/dmr-policies-h
