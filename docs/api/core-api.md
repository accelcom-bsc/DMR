---
sidebar_position: 1
title: Core API
---

`dmr.h` is the only header an application needs to include. It is a barrel: it pulls in the whole public API and wraps it in `extern "C"` so C++ callers can use it directly.

```c
#include "dmr.h"
```

| Section | What it covers |
|---------|----------------|
| [Configuration](#configuration) | Compile-time defaults and their environment overrides |
| [Status codes](#status-codes) | `DMRStatus`, returned by setters, control calls, and the analytics API |
| [Analytics](#analytics) | Event constants, `DMRAnalytics`, metrics API |
| [Sizing and control](#sizing-and-control) | How big the next expand/shrink is, and state queries |
| [Policies](#policies) | `DMRPolicy`, decision helpers, `dmr_set_policy` |
| [Lifecycle](#lifecycle) | `dmr_init` / `check` / `reconfigure` / `finalize`, `DMR_AUTO` |

The built-in policies are the one exception to the single include. Their constructors sit outside the barrel, because the code behind them is optional at build time, so reaching them takes one more header. See [Policy Headers](policy-headers).

---

## Configuration

Compile-time defaults, all settable as CMake variables of the same name. Most can also be overridden by an environment variable of the same name at launch; where a runtime setter exists it wins over both.

| Macro | Default | Overridable at runtime by | Description |
|-------|---------|---------------------------|-------------|
| `DMR_DEBUG_LEVEL` | `0` | environment | `0` = off, `1` = rank 0 only, `2` = all ranks |
| `DMR_PRINT_ANALYTICS` | `0` | environment | Print an analytics line at each reconfiguration |
| `DMR_NODES_IN_EXPAND` | `1` | environment, `dmr_set_nodes_next_expand()` | Nodes added per expand |
| `DMR_NODES_IN_SHRINK` | `1` | environment, `dmr_set_nodes_next_shrink()` | Nodes removed per shrink |
| `DMR_PROCS_PER_NODE` | `1` | environment, `dmr_set_ppn_next_expand()` | Processes spawned per added node |
| `DMR_DEFAULT_INHIBITOR` | `0` | environment, `dmr_set_reconf_step_inhibitor()` | Skip N of every N+1 `dmr_check` calls |
| `DMR_BLOCKING_REQ` | `0` | compile time only | Block in `dmr_check` until resources are acquired |
| `DMR_CHECKPOINT_RESTART` | `1` | compile time only | `0` uses `DMR_INTERCOMM` instead of checkpoint files |
| `DMR_JOBS_CAN_SHRINK` | `1` | compile time only | Allow shrinking Slurm jobs |
| `DMR_JOBS_CAN_GROW` | `0` | compile time only | Allow growing Slurm jobs (needs `DMR_JOBS_CAN_SHRINK=1`) |
| `DMR_SKIP_SSH_CHECK` | `0` | compile time only | Skip the SSH health check on new nodes |
| `DMR_SSH_CHECK_TIMEOUT` | `20` | compile time only | Seconds to wait for that health check |
| `CUSTOM_SLURM_BIN_PREFIX` | `""` | compile time only | Where expander jobs look for `scontrol` |

The remaining macros are **policy fallbacks**. DMR itself never reads them: each built-in policy resolves them in its constructor, from the environment first and from the macro otherwise.

| Macro | Default | Read by |
|-------|---------|---------|
| `DMR_DEFAULT_POLICY_MIN` | `1` | round, CE |
| `DMR_DEFAULT_POLICY_MAX` | `1` | round, CE |
| `DMR_DEFAULT_POLICY_STRIDE` | `2` | round |
| `DMR_TALP_TARGET_CE` | `0.8` | CE |
| `DMR_TALP_SENSITIVITY` | `15` | CE |

See [Configuration](../user-guide/configuration) for the full CMake and environment reference.

---

## Status codes

```c
typedef enum DMRStatusEnum {
    DMR_SUCCESS = 0,
    DMR_ERROR_STATUS,
    DMR_ERROR_UNINITIALIZED,
    DMR_ERROR_NOT_ROOT,
    DMR_ERROR_ARG_NULL,
    DMR_ERROR_BAD_ARGS,
    DMR_ERROR_UNSUPPORTED,
    DMR_ERROR_OUT_OF_MEM,
} DMRStatus;
```

| Value | Meaning |
|-------|---------|
| `DMR_SUCCESS` | Success |
| `DMR_ERROR_STATUS` | Unspecified failure |
| `DMR_ERROR_UNINITIALIZED` | `dmr_init` has not been called yet |
| `DMR_ERROR_NOT_ROOT` | Called from a rank other than 0, where only rank 0 is allowed |
| `DMR_ERROR_ARG_NULL` | A required argument was `NULL` |
| `DMR_ERROR_BAD_ARGS` | An argument was rejected |
| `DMR_ERROR_UNSUPPORTED` | Not supported in the current state or build |
| `DMR_ERROR_OUT_OF_MEM` | Out of memory |

The lifecycle functions return [`DMRAction`](#dmraction) instead of a status code.

---

## Analytics

### DMRAnalytics

```c
typedef struct {
    double      event_time;               // Unix timestamp of the event
    const char *function;                 // DMR function that emitted it
    const char *event;                    // Event identifier (DMR_EVENT_* or custom)
    int         world_size;               // MPI processes in the current MPI_COMM_WORLD
    int         node_count;               // Nodes in the current MPI_COMM_WORLD
    double      reconfiguration_time;     // Seconds taken by the last reconfiguration (-1 if N/A)
    double      communication_efficiency; // Last TALP accumulated CE (-1 if N/A)
    int         pending_nodes;            // Nodes requested but not yet secured
} DMRAnalytics;
```

Called from a non-root rank, `dmr_get_analytics` leaves the reconfiguration-specific fields (`reconfiguration_time`, `pending_nodes`) at `-1`.

### Functions

```c
DMRStatus dmr_get_analytics(DMRAnalytics *analytics);
DMRStatus dmr_create_custom_analytics_event(char const *event, DMRAnalytics **analytics_out);
DMRStatus dmr_destroy_custom_analytics_event(DMRAnalytics *analytics);
DMRStatus dmr_print_analytics_from(DMRAnalytics const *analytics_in);
```

A struct returned by `dmr_create_custom_analytics_event` is a **snapshot**, not a live view, and must be released with `dmr_destroy_custom_analytics_event`. The custom event string must not collide with a reserved `DMR_EVENT_*` constant.

### Event constants

| Constant | When emitted |
|----------|-------------|
| `DMR_EVENT_NONE` | No event yet |
| `DMR_EVENT_INIT_COMPLETE` | `dmr_init` completed |
| `DMR_EVENT_CHECK_CALLED` | `dmr_check` was called |
| `DMR_EVENT_STAY_CURRENT` | The configuration is left unchanged |
| `DMR_EVENT_START_EXPAND_SLURM` | Resources requested from Slurm |
| `DMR_EVENT_START_EXPAND_MPI` | MPI expansion started |
| `DMR_EVENT_START_SHRINK` | Shrink triggered |
| `DMR_EVENT_DATA_REDIST_COMPLETE` | Data redistribution finished |
| `DMR_EVENT_TALP_CHECK_CE_ACC` | TALP CE check performed |
| `DMR_EVENT_LAST_FINALIZE` | `dmr_finalize` called outside a reconfiguration |

See [Analytics](../user-guide/analytics) for usage.

---

## Sizing and control

How big the next reconfiguration is, plus the queries a decision needs. **Every value set here applies to the next reconfiguration only and resets afterwards.**

### Sizing setters (rank 0 only)

Non-root callers get `DMR_ERROR_NOT_ROOT` and change nothing.

```c
DMRStatus dmr_set_nodes_next_expand(int nodes);
DMRStatus dmr_set_procs_next_expand(int procs);   // exact total across the new nodes
DMRStatus dmr_set_ppn_next_expand(int ppn);       // processes per node; overrides procs
DMRStatus dmr_set_nodes_next_shrink(int nodes);
DMRStatus dmr_set_procs_next_shrink(int procs);
DMRStatus dmr_set_jobs_next_shrink(int jobs);     // remove N whole expansion jobs
```

### Sizing getters (rank 0 only)

Return `-1` on error, including when called from a non-root rank.

```c
int dmr_get_nodes_next_expand(void);
int dmr_get_procs_next_expand(void);
int dmr_get_nodes_next_shrink(void);
int dmr_get_procs_next_shrink(void);
```

### State queries

Callable from any rank.

```c
int dmr_get_current_node_count(void);   // nodes in the current MPI_COMM_WORLD
int dmr_get_reconfig_count(void);       // reconfigurations since launch; valid even before dmr_init
int dmr_get_active_expansions(void);    // expansion jobs currently active
int dmr_pending_expansion(void);        // 1 if an expansion is pending
```

### Expansion control and throttling

```c
DMRStatus dmr_cancel_expansion(void);              // collective
DMRStatus dmr_set_reconf_step_inhibitor(int steps);
```

`dmr_cancel_expansion` is **collective** and only valid while `dmr_pending_expansion()` returns `1`. The inhibitor makes DMR ignore N out of every N+1 `dmr_check` calls; it has no effect on a reconfiguration already underway.

---

## Policies

The policy interface: a policy is an object you register once, and DMR evaluates it whenever you call `dmr_check(USE_POLICY)`.

### Types

```c
typedef enum DMRPolicyOpEnum {
    DMR_POLICY_STAY = 0,
    DMR_POLICY_EXPAND,
    DMR_POLICY_SHRINK
} DMRPolicyOp;

typedef struct {
    DMRPolicyOp operation;
    int         nodes;      // delta, positive
    int         processes;  // 0 = let DMR size it
} DMRPolicySuggestion;

typedef struct {
    int   current_nodes;
    int   reconfig_count;
    int   nodes_in_expand;
    int   nodes_in_shrink;
    int   procs_in_expand;
    int   procs_in_shrink;
    void *internal_dmr_state;
    void *internal_controller_state;
} DMRPolicyContext;

struct DMRPolicyStruct {
    char const         *name;
    size_t              state_size;
    void               *state;
    DMRPolicyPopulateFn populate;   // optional: gather external data, all ranks
    DMRPolicyRunFn      run;        // required: pure decision, all ranks
    DMRPolicySaveFn     save;       // optional, never called by DMR
    DMRPolicyLoadFn     load;       // optional, never called by DMR
    DMRPolicyDestroyFn  destroy;    // optional, never called by DMR
};
```

### Registration

```c
DMRStatus dmr_set_policy(DMRPolicy *policy);
```

**Collective**: all ranks must call it, in the same order, with no `dmr_check` in between. DMR does not take ownership of the pointer: keep the object alive for as long as it may be evaluated. Passing `NULL` unregisters the policy, and `dmr_check(USE_POLICY)` then resolves to `SHOULD_STAY`.

### Decision helpers

```c
DMRPolicySuggestion dmr_policy_stay(void);
DMRPolicySuggestion dmr_policy_expand_fixed(int nodes, int processes);
DMRPolicySuggestion dmr_policy_shrink_fixed(int nodes, int processes);
DMRPolicySuggestion dmr_policy_expand_to(int target_nodes, int processes, DMRPolicyContext const *context);
DMRPolicySuggestion dmr_policy_shrink_to(int target_nodes, int processes, DMRPolicyContext const *context);
```

`_fixed` takes a delta, `_to` an absolute target node count. All of them degrade to `dmr_policy_stay()` when the delta would be zero or negative, or the context is `NULL`.

How the two callbacks are invoked is described in [Policies Overview](../user-guide/policies/overview#how-an-evaluation-works); writing your own policy is covered in [Custom Policies](../user-guide/policies/custom-policies).

---

## Lifecycle

### DMRSuggestion

Passed to `dmr_check` to say how this iteration's size is decided.

| Value | Description |
|-------|-------------|
| `USE_POLICY` | Evaluate the policy registered with `dmr_set_policy` |
| `SHOULD_EXPAND` | Expand by `dmr_get_nodes_next_expand()` nodes |
| `SHOULD_SHRINK` | Shrink by `dmr_get_nodes_next_shrink()` nodes |
| `SHOULD_STAY` | Do not reconfigure this iteration |

The per-policy enum values of 2.x (`ROUND_POLICY`, `CE_POLICY`, `SLURM4DMR_*`, …) are gone; policies are objects now. See [Policies Overview](../user-guide/policies/overview#migrating-from-2x).

### DMRAction

Returned by `dmr_init`, `dmr_check`, `dmr_reconfigure`, and `dmr_finalize`, telling the calling rank what to do next.

| Value | Meaning |
|-------|---------|
| `DMR_NO_ACTION` | No action required |
| `DMR_RECONF` | Call `dmr_reconfigure()` |
| `DMR_RESTART_RECONF` | Load checkpoint/data, then call `dmr_reconfigure()` |
| `DMR_REDIST_FINALIZE` | Save/send data, then call `dmr_finalize()` (rank exits) |
| `DMR_FINALIZE` | Call `dmr_finalize()` (rank exits) |
| `DMR_CLEANUP` | Optional cleanup, rank continues |
| `DMR_ERROR` | An error occurred |

### DMR_INTERCOMM

```c
extern MPI_Comm DMR_INTERCOMM;
```

Intercommunicator connecting the old and new processes during a reconfiguration. Only touch it when a `DMRAction` told you to (`DMR_RESTART_RECONF` or `DMR_REDIST_FINALIZE`) and `dmr_intercomm_available()` returns `1`, which requires a build with `DMR_CHECKPOINT_RESTART=0`. See [Data Redistribution](../user-guide/data-redistribution).

### Functions

```c
DMRAction dmr_init(int argc, char *argv[]);
DMRAction dmr_check(DMRSuggestion suggested_reconfiguration);
DMRAction dmr_reconfigure(void);
DMRAction dmr_finalize(void);
int       dmr_intercomm_available(void);
DMRAction dmr_get_last_action(void);
```

**`dmr_init`**: call immediately after `MPI_Init`, passing `argc`/`argv` untouched (DMR forwards them to spawned processes). **Collective.** Returns `DMR_NO_ACTION` on first launch, `DMR_RESTART_RECONF` on a process spawned by an expansion.

**`dmr_check`**: evaluate the suggestion (or the active policy, with `USE_POLICY`) and act on any pending reconfiguration. Call it once per iteration of your main loop. **Collective.**

**`dmr_reconfigure`**: perform the reconfiguration. Only valid after `dmr_check` or `dmr_init` returned `DMR_RECONF` or `DMR_RESTART_RECONF`. Handled for you by `DMR_AUTO`.

**`dmr_finalize`**: shut DMR down. Call it before `MPI_Finalize`. Not collective, and it is a termination point: it finalizes MPI and exits the rank, so no DMR call can follow it on that rank.

### DMR_AUTO

```c
DMR_AUTO(the_action, redist_func, restart_func, finalize_func)
```

Expands to a `switch` over the returned action and calls the right callback for you, including `dmr_reconfigure()` and `dmr_finalize()`. Pass `(void)NULL` for a callback you do not need.

```c
DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(),   cleanup());
DMR_AUTO(dmr_check(USE_POLICY), save(),    (void)NULL, cleanup());
DMR_AUTO(dmr_finalize(),        (void)NULL, (void)NULL, cleanup());
```

:::warning[The macro is a possible termination point]
On a leaving rank `DMR_AUTO` calls `dmr_finalize()`, which finalizes MPI and exits. Never call `MPI_Finalize` from `finalize_func`.
:::

Full semantics in [Reconfiguration Handling](../user-guide/reconfiguration-handling).
