---
title: Distributed Dataset
description: A DMR example that redistributes a dataset across processes after each reconfiguration.
---

This example shows how to manage a distributed dataset across dynamic reconfigurations. It is a more realistic workload than Hello World and demonstrates the `on_expand`, `on_shrink`, and `on_exit` callbacks working together.

The full source is available in `examples/distributed-dataset-sleep/` in the DMR repository.

## What it does

1. Each process owns a contiguous slice of a global integer array.
2. On expand, data is redistributed so all new processes receive equal-sized slices.
3. On shrink, leaving processes send their data to surviving processes before exiting.
4. Each iteration performs a simple computation (sleep) to simulate work.

## Data redistribution strategy

```
Before expand (2 ranks):
  rank 0: [0, 1, 2, 3]
  rank 1: [4, 5, 6, 7]

After expand (4 ranks):
  rank 0: [0, 1]
  rank 1: [2, 3]
  rank 2: [4, 5]
  rank 3: [6, 7]
```

The redistribution uses `MPI_Scatterv` (expand) and `MPI_Gatherv` + `MPI_Scatterv` (shrink) on the updated `MPI_COMM_WORLD`.

## Running it

```bash
cd examples/distributed-dataset-sleep
cmake -B build && cmake --build build

DMR_DEFAULT_POLICY_MIN=1 DMR_DEFAULT_POLICY_MAX=8 DMR_DEFAULT_POLICY_STRIDE=2 \
mpirun -n 1 ./distributed-dataset-sleep --array-size 64 --iterations 20
```

## Key points

- `on_exit` **must** send the local slice to a surviving rank before returning; otherwise data is lost.
- Rank 0 is the coordinator for gather/scatter operations; it must be a surviving rank in a shrink.
- After a reconfiguration, recompute your local slice bounds from the new `MPI_Comm_size` result.
