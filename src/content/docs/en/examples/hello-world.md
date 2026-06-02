---
title: Hello World
description: A minimal DMR application that prints the current process count after each reconfiguration.
---

This example demonstrates the minimal structure of a DMR application. It launches with a small number of processes, expands once, and then exits.

The full source is available in `examples/hello-world/` in the DMR repository.

## What it does

1. Initialises MPI and DMR.
2. Registers the `round` policy (expands by stride until max, then wraps).
3. In each iteration, calls `dmr_check` and prints the current rank and process count.
4. After the configured number of iterations, exits cleanly.

## Running it

```bash
# Build
cd examples/hello-world
cmake -B build && cmake --build build

# Run with 2 initial processes, allow up to 4
DMR_DEFAULT_POLICY_MIN=2 DMR_DEFAULT_POLICY_MAX=4 \
mpirun -n 2 ./hello-world
```

Expected output (order may vary by rank):

```
[rank 0 / 2] iteration 0
[rank 1 / 2] iteration 0
-- reconfiguration: 2 -> 4 nodes --
[rank 0 / 4] iteration 1
[rank 1 / 4] iteration 1
[rank 2 / 4] iteration 1
[rank 3 / 4] iteration 1
```

## Key points

- The `on_expand` callback simply prints the new communicator size — no data redistribution is needed for this toy example.
- The `on_exit` callback is a no-op because no heap memory is allocated per-rank.
- `DMR_AUTO` handles the `DMR_EXIT` action automatically for ranks that are removed.
