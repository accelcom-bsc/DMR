---
sidebar_position: 2
title: Distributed Dataset
---

Shows how to manage a distributed dataset across dynamic reconfigurations.

Source: `examples/distributed-dataset-sleep/` in the DMR repository.

## What it does

1. Each process owns a contiguous slice of a global integer array.
2. On expand, data is redistributed to include the new processes.
3. On shrink, leaving processes send their data to survivors before exiting.
4. Each iteration sleeps to simulate work.

## Data redistribution

```
Before expand (2 ranks):   rank 0: [0,1,2,3]   rank 1: [4,5,6,7]
After expand  (4 ranks):   rank 0: [0,1]   rank 1: [2,3]   rank 2: [4,5]   rank 3: [6,7]
```

Uses `MPI_Scatterv` (expand) and `MPI_Gatherv` + `MPI_Scatterv` (shrink).

## Running it

```bash
cd examples/distributed-dataset-sleep
cmake -B build && cmake --build build

DMR_DEFAULT_POLICY_MIN=1 DMR_DEFAULT_POLICY_MAX=8 DMR_DEFAULT_POLICY_STRIDE=2 \
dmr mpirun -n 1 ./distributed-dataset-sleep --array-size 64 --iterations 20
```

## Key points

- `on_exit` **must** send the local slice to a surviving rank before returning; otherwise data is lost.
- After a reconfiguration, recompute local slice bounds from the new `MPI_Comm_size`.
