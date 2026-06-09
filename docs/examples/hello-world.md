---
sidebar_position: 1
title: Hello World
---

A minimal DMR application that prints the current process count after each reconfiguration.

Source: `examples/hello-world/` in the DMR repository.

## What it does

1. Initialises MPI and DMR.
2. Registers the `round` policy.
3. Calls `dmr_check` each iteration and prints rank/size.
4. Exits cleanly after the configured number of iterations.

## Running it

```bash
cd examples/hello-world
cmake -B build && cmake --build build

DMR_DEFAULT_POLICY_MIN=2 DMR_DEFAULT_POLICY_MAX=4 \
dmr mpirun -n 2 ./hello-world
```

Expected output:

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

- `restart_func` just prints the new size, no data to redistribute in this toy example.
- `finalize_func` is a no-op because no heap memory is allocated per-rank.
