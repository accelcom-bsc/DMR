---
title: The DMR_AUTO Macro
description: Understanding the DMR_AUTO convenience macro.
---

`DMR_AUTO` is a convenience macro that wraps the three DMR lifecycle functions (`dmr_init`, `dmr_check`, `dmr_finalize`) and automatically dispatches to the correct callback based on the outcome.

## Signature

```c
DMR_AUTO(call, on_expand, on_shrink, on_exit)
```

| Parameter | Description |
|-----------|-------------|
| `call` | One of `dmr_init(...)`, `dmr_check(...)`, or `dmr_finalize()` |
| `on_expand` | Expression evaluated when processes are **added** |
| `on_shrink` | Expression evaluated when processes are **removed** |
| `on_exit` | Expression evaluated when **this rank is being removed** from the job |

## How it works

`DMR_AUTO` evaluates `call` and checks the returned `DMRAction`:

| DMRAction | Macro behaviour |
|-----------|-----------------|
| `DMR_NO_ACTION` | No callback invoked |
| `DMR_RECONF` (expand) | Evaluates `on_expand` |
| `DMR_RECONF` (shrink) | Evaluates `on_shrink` |
| `DMR_EXIT` | Evaluates `on_exit`, then terminates the rank |
| Error | Prints an error and calls `MPI_Abort` |

## Examples

### dmr_init — no callbacks needed at startup

```c
DMR_AUTO(dmr_init(argc, argv), (void)NULL, (void)NULL, (void)NULL);
```

### dmr_check — full reconfiguration handling

```c
DMR_AUTO(dmr_check(USE_POLICY),
         redistribute_data(),   // on_expand
         redistribute_data(),   // on_shrink
         cleanup());            // on_exit
```

### dmr_finalize — only exit callback matters

```c
DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
```

## Using (void)NULL

Pass `(void)NULL` for any callback you don't need. This is a valid no-op expression in C.

## Calling functions with arguments

You can call any expression, including functions with arguments:

```c
DMR_AUTO(dmr_check(USE_POLICY),
         redistribute(my_array, n),
         redistribute(my_array, n),
         free_resources(my_array));
```

## Without the macro

If you prefer explicit control, you can call the functions directly and handle the returned `DMRAction` yourself:

```c
DMRAction action = dmr_check(USE_POLICY);
if (action == DMR_RECONF) {
    redistribute_data();
} else if (action == DMR_EXIT) {
    cleanup();
    MPI_Finalize();
    exit(0);
}
```
