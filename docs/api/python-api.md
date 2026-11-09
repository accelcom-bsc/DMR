---
sidebar_position: 4
title: Python API
---

Reference for the `dmr` Python package. For installation and a first program, see the [Python Bindings](../user-guide/bindings/python) guide.

```python
from mpi4py import MPI   # initializes MPI first
import dmr
```

Everything below is available directly under `dmr`. Each function maps to the C function of the same name with the `dmr_` prefix removed; see the [Core API](core-api) for what each one does in DMR.

| Section | What it covers |
|---------|----------------|
| [Conventions](#conventions) | How C types, errors and names are translated |
| [Lifecycle](#lifecycle) | `init`, `auto`, `check`, `reconfigure`, `finalize`, `intercomm` |
| [Sizing and control](#sizing-and-control) | How big the next expand or shrink is, and state queries |
| [Policies](#policies) | Built-in policies and decision helpers |
| [Analytics](#analytics) | `Analytics`, `get_analytics`, custom events |
| [Enums](#enums) | `Action`, `Suggestion`, `Status`, `PolicyOp` |
| [Errors](#errors) | `DMRError` |
| [Low-level access](#low-level-access) | `dmr._raw` |

---

## Conventions

| C | Python |
|---|--------|
| `dmr_<name>(...)` | `dmr.<name>(...)` |
| `DMR<Type>` | `dmr.<Type>`, e.g. `DMRAction` is `dmr.Action` |
| Enum value `DMR_RECONF` | `dmr.Action.RECONF` (an `IntEnum`) |
| Function returning `DMRStatus` | Returns the `Status` on success, raises [`DMRError`](#errors) on failure. `Status.ERROR_NOT_ROOT` is not a failure. |
| `const char *` | `str` |
| `int argc, char *argv[]` | `list[str]` |
| `dmr_get_<x>(T *out)` | Returns `T` |
| `int` used as a boolean | `bool` |
| Pointer return that may be `NULL` | `None` |

All functions require `dmr.init()` to have been called first, except `default_argv`.

---

## Lifecycle

### `dmr.init`

```python
dmr.init(argv: Sequence[str] | None = None, *,
         redist=None, restart=None, finalize=None) -> Action
```

Initializes DMR and drives the action it returns through [`dmr.auto`](#dmrauto). Call it once, right after MPI is initialized. **Collective.**

- `argv` defaults to [`dmr.default_argv()`](#dmrdefault_argv). DMR uses it to relaunch the program on every reconfiguration.
- In a generation started by a reconfiguration, this is where `restart` runs.

Returns the action DMR answered with.

### `dmr.auto`

```python
dmr.auto(action: Action, *,
         redist=None, restart=None, finalize=None) -> Action
```

Carries out one DMR action, the way the `DMR_AUTO` macro does in C. Pass it the result of `dmr.init`, `dmr.check` or `dmr.finalize`. The callbacks take no arguments:

| Callback | Runs | Use it to |
|----------|------|-----------|
| `redist` | On the old generation, before it ends | Send data out over [`dmr.intercomm()`](#dmrintercomm), or save it |
| `restart` | On the new generation, before it continues | Receive or load data |
| `finalize` | Before DMR finalizes the process, and on `CLEANUP` | Release application resources |

What it does for each action:

| `action` | Behaviour |
|----------|-----------|
| `NO_ACTION` | Nothing |
| `RECONF` | Calls `reconfigure()`. If the process must leave, runs `redist`, then ends the process |
| `RESTART_RECONF` | Runs `restart`, then calls `reconfigure()` |
| `REDIST_FINALIZE` | Runs `redist`, then ends the process |
| `FINALIZE` | Ends the process |
| `CLEANUP` | Runs `finalize`; the process continues |
| `ERROR` | Nothing |

"Ends the process" means: run `finalize`, flush `stdout` and `stderr`, and call `dmr.finalize()`, which exits through C's `exit()`. Code after the call does not run. Returns `action` when the process continues.

### `dmr.default_argv`

```python
dmr.default_argv() -> list[str]
```

The command line DMR should relaunch: the absolute path of the running interpreter (`sys.executable`) followed by its original arguments (`sys.orig_argv[1:]`), so interpreter options and a virtualenv's `python` survive the relaunch.

### `dmr.check`

```python
dmr.check(suggested_reconfiguration: Suggestion) -> Action
```

Evaluates the suggestion, or the registered policy with `Suggestion.USE_POLICY`, and returns what the process should do. Call it once per iteration of the main loop and pass the result to `dmr.auto`. **Collective.**

### `dmr.reconfigure`

```python
dmr.reconfigure() -> Action
```

Performs the reconfiguration. `dmr.auto` calls it for you.

### `dmr.finalize`

```python
dmr.finalize() -> Action
```

Shuts DMR down. A termination point: when a reconfiguration is complete it ends the process. Call it as `dmr.auto(dmr.finalize())` at the end of the program, so the stream flush and `finalize` callback happen.

### `dmr.intercomm`

```python
dmr.intercomm() -> mpi4py.MPI.Intercomm
```

The intercommunicator between this generation and the other one, as an `mpi4py` object. Only valid inside the `redist` and `restart` callbacks, with a DMR built with the `spawn` mechanism (the default). DMR owns it: do not free or disconnect it.

### `dmr.intercomm_available`

```python
dmr.intercomm_available() -> bool
```

Whether DMR's intercommunicator can be used right now.

### `dmr.get_last_action`

```python
dmr.get_last_action() -> Action
```

The last action DMR returned to this process.

---

## Sizing and control

The setters only act on rank 0. On other ranks they return `Status.ERROR_NOT_ROOT` without raising.

| Function | Returns | Description |
|----------|---------|-------------|
| `set_nodes_next_expand(nodes: int)` | `Status` | Nodes to add in the next expansion |
| `set_procs_next_expand(procs: int)` | `Status` | Processes to add in the next expansion |
| `set_ppn_next_expand(ppn: int)` | `Status` | Processes per node in the next expansion |
| `set_nodes_next_shrink(nodes: int)` | `Status` | Nodes to remove in the next shrink |
| `set_procs_next_shrink(procs: int)` | `Status` | Processes to remove in the next shrink |
| `set_allocs_next_shrink(allocs: int)` | `Status` | Allocations to release in the next shrink |
| `get_nodes_next_expand()` | `int` | Nodes the next expansion will add |
| `get_procs_next_expand()` | `int` | Processes the next expansion will add |
| `get_nodes_next_shrink()` | `int` | Nodes the next shrink will remove |
| `get_procs_next_shrink()` | `int` | Processes the next shrink will remove |
| `get_reconfig_count()` | `int` | Reconfigurations completed so far |
| `get_current_node_count()` | `int` | Nodes the job runs on now |
| `get_active_allocations()` | `int` | Slurm allocations the job holds |
| `pending_expansion()` | `bool` | Whether an expansion request is waiting for resources |
| `cancel_expansion()` | `Status` | Cancel the pending expansion request |
| `set_reconf_step_inhibitor(steps: int)` | `Status` | Skip `steps` of every `steps + 1` calls to `check` |

---

## Policies

| Function | Returns | Description |
|----------|---------|-------------|
| `get_policy_round()` | `Policy` pointer | Built-in round policy |
| `get_policy_ce()` | `Policy` pointer | Built-in communication-efficiency policy |
| `get_policy_list()` | `Policy` pointer | Built-in list policy |
| `set_policy(policy)` | `Status` | Register the policy used with `Suggestion.USE_POLICY` |
| `policy_stay()` | `PolicySuggestion` | Decision helper: do not reconfigure |
| `policy_expand_fixed(nodes, processes)` | `PolicySuggestion` | Decision helper: expand by a fixed amount |
| `policy_shrink_fixed(nodes, processes)` | `PolicySuggestion` | Decision helper: shrink by a fixed amount |
| `policy_expand_to(target_nodes, processes, context)` | `PolicySuggestion` | Decision helper: expand up to a node count |
| `policy_shrink_to(target_nodes, processes, context)` | `PolicySuggestion` | Decision helper: shrink down to a node count |

Each built-in policy is only available if DMR was built with it; calling one that was not built fails, because the C function is not in `libdmr.so`. See [Policy Headers](policy-headers). Their parameters come from environment variables; see [Built-in Policies](../user-guide/policies/dmr-policies).

```python
dmr.set_policy(dmr.get_policy_round())
dmr.auto(dmr.check(dmr.Suggestion.USE_POLICY), redist=save)
```

`Policy`, `PolicySuggestion` and `PolicyContext` are the `ctypes` structures `DMRPolicy`, `DMRPolicySuggestion` and `DMRPolicyContext` from `dmr._raw`.

:::note
Policies cannot be written in Python yet. A policy's `run` callback returns a struct by value, which `ctypes` callbacks do not support. Use a built-in policy or [manual control](../user-guide/policies/manual-control).
:::

---

## Analytics

```python
dmr.get_analytics() -> Analytics
dmr.print_custom_analytics_event(event: str) -> Status
```

`get_analytics` returns a frozen dataclass:

| Field | Type | Description |
|-------|------|-------------|
| `event_time` | `float` | When the event happened |
| `function` | `str \| None` | DMR function that recorded it |
| `event` | `str \| None` | Event name, e.g. `DMR_EVENT_RECONFIG_COMPLETE` |
| `world_size` | `int` | MPI processes |
| `node_count` | `int` | Nodes |
| `reconfiguration_time` | `float` | Duration of the last reconfiguration |
| `communication_efficiency` | `float` | Communication efficiency, when measured |
| `pending_nodes` | `int` | Nodes requested and not yet granted |

`print_custom_analytics_event` prints an analytics line with your own event name. See [Analytics](../user-guide/analytics).

---

## Enums

All are `enum.IntEnum`.

**`dmr.Action`**, returned by `init`, `check`, `reconfigure` and `finalize`: `NO_ACTION`, `RECONF`, `RESTART_RECONF`, `REDIST_FINALIZE`, `FINALIZE`, `CLEANUP`, `ERROR`. See [`DMRAction`](core-api#dmraction).

**`dmr.Suggestion`**, passed to `check`: `USE_POLICY`, `SHOULD_EXPAND`, `SHOULD_SHRINK`, `SHOULD_STAY`. See [`DMRSuggestion`](core-api#dmrsuggestion).

**`dmr.Status`**: `SUCCESS`, `ERROR_STATUS`, `ERROR_UNINITIALIZED`, `ERROR_NOT_ROOT`, `ERROR_ARG_NULL`, `ERROR_BAD_ARGS`, `ERROR_UNSUPPORTED`, `ERROR_OUT_OF_MEM`, `ERROR_RESOURCE_REQUEST`. See [Status codes](core-api#status-codes).

**`dmr.PolicyOp`**: `STAY`, `EXPAND`, `SHRINK`.

---

## Errors

```python
class dmr.DMRError(RuntimeError)
```

Raised when a function that returns a `Status` in C returns a failing one. `Status.ERROR_NOT_ROOT` does not raise.

```python
try:
    dmr.set_nodes_next_expand(2)
except dmr.DMRError as e:
    print("DMR refused:", e)
```

If `libdmr.so` cannot be found (`$DMR_PATH/lib`, then the library search path), the first call into DMR fails with an error saying where it looked.

---

## Low-level access

`dmr._raw` declares the C API one to one with `ctypes`: C names, C types, nothing converted. Use it only for what the Pythonic layer does not cover, such as the policy callback types (`_raw.DMRPolicyRunFn` and friends).
