---
title: dmr.h
description: Complete API reference for the main DMR header.
---

Include `dmr.h` to access the core DMR API.

```c
#include "dmr.h"
```

## Types

### DMRAction

Returned by `dmr_init`, `dmr_check`, and `dmr_finalize`.

```c
typedef enum DMRActionEnum {
    DMR_NO_ACTION,
    DMR_RECONF,
    DMR_EXIT,
    DMR_ERROR
} DMRAction;
```

| Value | Meaning |
|-------|---------|
| `DMR_NO_ACTION` | No reconfiguration occurred |
| `DMR_RECONF` | A reconfiguration happened; callbacks were invoked |
| `DMR_EXIT` | This rank is being removed; exit callback was invoked |
| `DMR_ERROR` | An error occurred |

### DMRSuggestion

Passed to `dmr_check` to select how the policy is applied.

```c
typedef enum DMRSuggestionEnum {
    USE_POLICY,
    SHOULD_EXPAND,
    SHOULD_SHRINK,
    SHOULD_STAY
} DMRSuggestion;
```

| Value | Meaning |
|-------|---------|
| `USE_POLICY` | Let the registered policy decide |
| `SHOULD_EXPAND` | Hint: try to expand |
| `SHOULD_SHRINK` | Hint: try to shrink |
| `SHOULD_STAY` | Hint: do not reconfigure this iteration |

## Functions

### dmr_init

```c
DMRAction dmr_init(int argc, char **argv);
```

Initializes DMR. Must be called after `MPI_Init` and before any other DMR function. **Collective** — all ranks must call it.

### dmr_check

```c
DMRAction dmr_check(DMRSuggestion suggestion);
```

Evaluates the active policy (or the provided hint) and performs a reconfiguration if warranted. Call this inside your main loop at a point where a reconfiguration is safe. **Collective** — all ranks must call it.

### dmr_finalize

```c
DMRAction dmr_finalize(void);
```

Shuts down DMR. Must be called before `MPI_Finalize`. **Collective** — all ranks must call it.

### dmr_set_policy

```c
int dmr_set_policy(DMRPolicy *policy);
```

Registers a policy object. **Collective** — all ranks must call it in the same order. Must not be called while a `dmr_check` is in progress.

## Macros

### DMR_AUTO

```c
DMR_AUTO(call, on_expand, on_shrink, on_exit)
```

Convenience wrapper that evaluates `call` and dispatches to the appropriate callback based on the returned `DMRAction`. See [The DMR_AUTO Macro](/en/user-guide/dmr-auto-macro/) for full documentation.

### DMR_DEBUG_LEVEL

```c
#define DMR_DEBUG_LEVEL 0
```

Compile-time debug verbosity. Can be overridden at runtime with the environment variable of the same name.

### DMR_PRINT_ANALYTICS

```c
#define DMR_PRINT_ANALYTICS 0
```

Print analytics at each reconfiguration when set to `1`. Can be overridden at runtime.
