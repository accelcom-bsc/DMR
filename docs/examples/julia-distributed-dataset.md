---
sidebar_position: 4
title: Julia Distributed Dataset
---

A malleable Julia application that keeps a distributed dataset consistent across reconfigurations, moving it over DMR's intercommunicator through the [Julia Bindings](../api/julia-bindings). It is the Julia counterpart of [Distributed Dataset](distributed-dataset), restricted to the in-memory transfer.

Source: [`tests/integration/dataset.jl`](https://gitlab.bsc.es/accelcom/releases/dmr/tools/julia-dmr/-/blob/main/tests/integration/dataset.jl) in the `julia-dmr` repository. It is also one of the bindings' integration tests.

## What it does

1. Splits a dataset of `SIZE = 1024` elements across ranks, giving the first `mod(SIZE, n)` ranks one extra element. Element `i` is the number `i`, so each rank can validate its slice by comparing it against the range it should own.
2. Initialises MPI and DMR, passing `dmr_init` a `restart` callback that receives the dataset over `dmr_intercomm()` before anything else runs.
3. Grows one process at a time up to `GROW_TO = 3`, then shrinks back to one, using [manual control](../user-guide/policies/manual-control) the same way as [Julia Hello World](julia-hello-world).
4. On every reconfiguration, sends the dataset to the next generation with a single `MPI_Alltoallv` over the intercommunicator, from a `redist` callback passed to `dmr_auto`.
5. Validates the data it received at the start of every generation, and fails on any mismatch.

## Redistribution over the intercommunicator

The program uses the intercommunicator transfer described in [Data Redistribution](../user-guide/data-redistribution#intercommunicator): old and new processes are alive at the same time for a short window, and the old ones send their data directly to the new ones.

```julia
dmr_init(restart = () -> (received[] = receive_dataset()))   # new generation
...
action = DMRBindings.dmr_check(DMRBindings.SHOULD_EXPAND)
dmr_auto(action; redist = () -> send_dataset(data))           # old generation
```

Both callbacks call `dmr_intercomm()` and exchange the overlapping ranges of the old and new layouts with one `Alltoallv`. Two details are specific to Julia:

- `MPI.jl`'s high-level `Alltoallv!` assumes the counts are indexed by the local group, which only holds for an intracommunicator. On an intercommunicator they are indexed by the remote group, so the program calls `MPI.API.MPI_Alltoallv` directly, and `MPI.API.MPI_Comm_remote_size` for the remote side's size.
- `dmr_intercomm()` is only valid inside the `redist` and `restart` callbacks, and only with DMR's `spawn` mechanism (`DMR_MECHANISM=spawn`, the default).

## Running it

Follow [Running an example on MiniDMR](../api/julia-bindings#running-an-example-on-minidmr), selecting this program. DMR is built there with its defaults, which include the `spawn` mechanism:

```bash
git clone --recurse-submodules https://gitlab.bsc.es/accelcom/releases/dmr/tools/julia-dmr.git ~/julia-dmr
cd ~/julia-dmr
nix develop
just int test=dataset.jl
```

On a real cluster, the launch command is the same as for [Julia Hello World](julia-hello-world#running-it), with `tests/integration/dataset.jl` as the script, against a DMR built with `DMR_MECHANISM=spawn`.

## Expected output

Filtered down to the `[julia]` lines, the dataset is validated at the start of every generation, growing 1 &rarr; 2 &rarr; 3 processes and shrinking back to 1:

```text
[julia] generation reconfig=0 nodes=1 world_size=1: 1024 elements validated, 1024 on rank 0
[julia] expanding 1 -> 2 processes, redistributing 1024 elements
[julia] end of generation 0
[julia] generation reconfig=1 nodes=2 world_size=2: 1024 elements validated, 512 on rank 0
[julia] expanding 2 -> 3 processes, redistributing 1024 elements
[julia] end of generation 1
[julia] generation reconfig=2 nodes=3 world_size=3: 1024 elements validated, 342 on rank 0
[julia] shrinking 3 -> 2 processes, redistributing 1024 elements
[julia] end of generation 2
...
[julia] last generation, nothing left to reconfigure
```

## Key points

- Every element is checked after every reconfiguration, so a redistribution bug fails fast instead of silently corrupting data.
- `SIZE` does not need to be divisible by the world size: the split hands out the remainder one element at a time.
- The program only implements the intercommunicator transfer, not checkpoint files: it is the Julia analogue of the in-memory build of the C [`distributed-dataset-sleep`](distributed-dataset) example.
- As in [Julia Hello World](julia-hello-world#key-points), the process exits explicitly with `exit(0)` after `MPI.Finalize()`.
