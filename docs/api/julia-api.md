---
sidebar_position: 3
title: Julia API
---

Reference for the `DMR` Julia package. For installation and a first program, see the [Julia Bindings](../user-guide/bindings/julia) guide.

```julia
using MPI, DMR
```

The package has two parts:

| Part | Contents |
|------|----------|
| [`DMR`](#lifecycle) | `dmr_init`, `dmr_auto`, `dmr_intercomm`, `dmr_argv`: the lifecycle helpers, written in Julia |
| [`DMRBindings`](#dmrbindings) | Every C function, type and constant of the [Core API](core-api), with the same names |

`using DMR` exports the four helpers and the `DMRBindings` module. Everything else is called as `DMRBindings.<name>`.

---

## Lifecycle

### `dmr_init`

```julia
dmr_init(argv::Vector{String} = dmr_argv();
         redist = nothing, restart = nothing, finalize = nothing) -> DMRAction
```

Initializes DMR and drives the action it returns through [`dmr_auto`](#dmr_auto). Call it once, right after `MPI.Init()`. **Collective.**

- `argv` defaults to [`dmr_argv()`](#dmr_argv). DMR uses it to relaunch the program on every reconfiguration.
- In a generation started by a reconfiguration, this is where `restart` runs.

### `dmr_auto`

```julia
dmr_auto(action::DMRAction;
         redist = nothing, restart = nothing, finalize = nothing,
         exit_code::Integer = 0) -> DMRAction
```

Carries out one DMR action, the way the `DMR_AUTO` macro does in C. Pass it the result of `dmr_init`, `DMRBindings.dmr_check` or `DMRBindings.dmr_finalize`. The callbacks are zero-argument functions:

| Callback | Runs | Use it to |
|----------|------|-----------|
| `redist` | On the old generation, before it ends | Send data out over [`dmr_intercomm()`](#dmr_intercomm), or save it |
| `restart` | On the new generation, before it continues | Receive or load data |
| `finalize` | Before DMR finalizes the process, and on `DMR_CLEANUP` | Release application resources |

What it does for each action:

| `action` | Behaviour |
|----------|-----------|
| `DMR_NO_ACTION` | Nothing |
| `DMR_RECONF` | Calls `dmr_reconfigure()`. If the process must leave, runs `redist`, then ends the process |
| `DMR_RESTART_RECONF` | Runs `restart`, then calls `dmr_reconfigure()` |
| `DMR_REDIST_FINALIZE` | Runs `redist`, then ends the process |
| `DMR_FINALIZE` | Ends the process |
| `DMR_CLEANUP` | Runs `finalize`; the process continues |
| `DMR_ERROR` | Logs a warning |

"Ends the process" means: run `finalize`, call `dmr_finalize()`, `MPI.Finalize()`, and `exit(exit_code)`. Code after the call does not run. Returns `action` when the process continues.

### `dmr_argv`

```julia
dmr_argv() -> Vector{String}
```

The command line DMR should relaunch: the `julia` executable, `-t <threads>`, `--project=<active project>`, the script (`PROGRAM_FILE`) and its `ARGS`. DMR relaunches `argv[0]`, which for Julia has to be the interpreter rather than the `.jl` file.

### `dmr_intercomm`

```julia
dmr_intercomm() -> MPI.Comm
```

The intercommunicator between this generation and the other one. Only valid inside the `redist` and `restart` callbacks, with a DMR built with the `spawn` mechanism (the default). The remote group has a different size; get it with `MPI.API.MPI_Comm_remote_size`. DMR owns the communicator: do not free it.

`MPI.jl`'s high-level collectives assume an intracommunicator, so for collectives on it, such as `Alltoallv`, call the C functions through `MPI.API`. See [Julia Distributed Dataset](../examples/julia/distributed-dataset#how-the-data-moves).

---

## `DMRBindings`

Generated from DMR's headers. Names, arguments and return types match the [Core API](core-api) exactly; integer arguments are `Cint`, and `DMRStatus` is returned as a value, not raised.

### Lifecycle

| Function | Returns |
|----------|---------|
| `dmr_check(suggested_reconfiguration::DMRSuggestion)` | `DMRAction` |
| `dmr_reconfigure()` | `DMRAction` |
| `dmr_finalize()` | `DMRAction` |
| `dmr_intercomm_available()` | `Bool` |
| `dmr_get_last_action()` | `DMRAction` |
| `dmr_init(argc, argv)` | `DMRAction`. Prefer [`dmr_init`](#dmr_init) from `DMR`, which builds `argv` |

### Sizing and control

The setters only act on rank 0; other ranks get `DMR_ERROR_NOT_ROOT`.

| Function | Returns |
|----------|---------|
| `dmr_set_nodes_next_expand(nodes)` | `DMRStatus` |
| `dmr_set_procs_next_expand(procs)` | `DMRStatus` |
| `dmr_set_ppn_next_expand(ppn)` | `DMRStatus` |
| `dmr_set_nodes_next_shrink(nodes)` | `DMRStatus` |
| `dmr_set_procs_next_shrink(procs)` | `DMRStatus` |
| `dmr_set_allocs_next_shrink(allocs)` | `DMRStatus` |
| `dmr_get_nodes_next_expand()` | `Cint` |
| `dmr_get_procs_next_expand()` | `Cint` |
| `dmr_get_nodes_next_shrink()` | `Cint` |
| `dmr_get_procs_next_shrink()` | `Cint` |
| `dmr_get_reconfig_count()` | `Cint` |
| `dmr_get_current_node_count()` | `Cint` |
| `dmr_get_active_allocations()` | `Cint` |
| `dmr_pending_expansion()` | `Bool` |
| `dmr_cancel_expansion()` | `DMRStatus` |
| `dmr_set_reconf_step_inhibitor(steps)` | `DMRStatus` |

A typical status check:

```julia
status = DMRBindings.dmr_set_nodes_next_expand(Cint(2))
status in (DMRBindings.DMR_SUCCESS, DMRBindings.DMR_ERROR_NOT_ROOT) ||
    error("dmr_set_nodes_next_expand returned $status")
```

### Policies

| Function | Returns |
|----------|---------|
| `dmr_get_policy_round()` | `Ptr{DMRPolicy}` |
| `dmr_get_policy_ce()` | `Ptr{DMRPolicy}` |
| `dmr_get_policy_list()` | `Ptr{DMRPolicy}` |
| `dmr_set_policy(policy::Ptr{DMRPolicy})` | `DMRStatus` |
| `dmr_policy_stay()` | `DMRPolicySuggestion` |
| `dmr_policy_expand_fixed(nodes, processes)` | `DMRPolicySuggestion` |
| `dmr_policy_shrink_fixed(nodes, processes)` | `DMRPolicySuggestion` |
| `dmr_policy_expand_to(target_nodes, processes, context::Ptr{DMRPolicyContext})` | `DMRPolicySuggestion` |
| `dmr_policy_shrink_to(target_nodes, processes, context::Ptr{DMRPolicyContext})` | `DMRPolicySuggestion` |

Each built-in policy is only available if DMR was built with it; see [Policy Headers](policy-headers).

```julia
DMRBindings.dmr_set_policy(DMRBindings.dmr_get_policy_round())
dmr_auto(DMRBindings.dmr_check(DMRBindings.USE_POLICY); redist = save)
```

The structs `DMRPolicy`, `DMRPolicySuggestion` and `DMRPolicyContext` mirror their C layout; the policy callback types (`DMRPolicyRunFn` and so on) are `Ptr{Cvoid}`.

### Analytics

| Function | Returns |
|----------|---------|
| `dmr_get_analytics(analytics::Ptr{DMRAnalytics})` | `DMRStatus`, filling `analytics` |
| `dmr_print_custom_analytics_event(event::String)` | `DMRStatus` |

```julia
a = Ref{DMRBindings.DMRAnalytics}()
DMRBindings.dmr_get_analytics(a)
a[].world_size, a[].node_count
```

`DMRAnalytics` has the fields of the C struct, with `function` renamed to `_function` because it is a Julia keyword. The string fields are `Ptr{Cchar}`; read them with `unsafe_string`. The event names are available as string constants, e.g. `DMRBindings.DMR_EVENT_RECONFIG_COMPLETE`.

### Enums

| Enum | Values |
|------|--------|
| `DMRAction` | `DMR_NO_ACTION`, `DMR_RECONF`, `DMR_RESTART_RECONF`, `DMR_REDIST_FINALIZE`, `DMR_FINALIZE`, `DMR_CLEANUP`, `DMR_ERROR` |
| `DMRSuggestion` | `USE_POLICY`, `SHOULD_EXPAND`, `SHOULD_SHRINK`, `SHOULD_STAY` |
| `DMRStatus` | `DMR_SUCCESS`, `DMR_ERROR_STATUS`, `DMR_ERROR_UNINITIALIZED`, `DMR_ERROR_NOT_ROOT`, `DMR_ERROR_ARG_NULL`, `DMR_ERROR_BAD_ARGS`, `DMR_ERROR_UNSUPPORTED`, `DMR_ERROR_OUT_OF_MEM`, `DMR_ERROR_RESOURCE_REQUEST` |
| `DMRPolicyOp` | `DMR_POLICY_STAY`, `DMR_POLICY_EXPAND`, `DMR_POLICY_SHRINK` |

All values are constants inside `DMRBindings`, e.g. `DMRBindings.SHOULD_EXPAND`.

---

## Loading `libdmr`

`libdmr` is loaded when the package is first used, from `$DMR_PATH/lib/libdmr.so`. If `DMR_PATH` is unset or the file is missing, loading fails with a message saying which path it tried. The library is opened in the global symbol scope, which Slurm's plugins need.

Compile-time configuration macros from `dmr_config.h` (`DMR_DEBUG_LEVEL`, `DMR_PROCS_PER_NODE`, ...) are deliberately not exposed, because the library may have been built with different values. Read the current values at run time with the getters above.
