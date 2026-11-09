---
sidebar_position: 2
sidebar_label: Distributed Dataset
title: Julia Distributed Dataset
---

A malleable Julia program that keeps a distributed array consistent while the job grows and shrinks. On every reconfiguration, the old processes send their part of the array directly to the new ones over MPI, and the new ones check that every element arrived. It is the Julia counterpart of [Distributed Dataset](../c/distributed-dataset).

Source: [`tests/integration/dataset.jl`](https://gitlab.bsc.es/accelcom/releases/dmr/tools/julia-dmr/-/blob/main/tests/integration/dataset.jl) in the `julia-dmr` repository.

:::tip
Run [Julia Hello World](hello-world) first. This example uses the same cluster, the same DMR build and the same Julia setup, so if you have done that one, you can go straight to [step 3](#step-3-run-the-example).
:::

## What it does

1. Creates an array of 1024 numbers, where element `i` is the number `i`, and splits it across the MPI processes.
2. Grows from 1 to 3 processes and shrinks back to 1, one process at a time.
3. On every reconfiguration, sends each piece of the array from the old processes to the new ones, which split it differently because there are now more or fewer of them.
4. At the start of every generation, checks every element it received, and stops with an error if anything is wrong.

## Step 1: Prepare the cluster

If you do not have a cluster from [Julia Hello World](hello-world) running, repeat its [steps 1 to 4](hello-world#step-1-get-the-code): clone the repository, start the cluster, build DMR, and set up Julia. In short:

```bash
cd ~/julia-dmr
minidmr start --nodes 4 -i registry.gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr:dmr-3.0.0
minidmr enter
```

## Step 2: Set the environment

Inside the controller, point to your DMR build and to Julia:

```bash
export DMR_PATH=$(pwd)/build/install
export PATH=$HOME/.juliaup/bin:$PATH
```

This example needs DMR's `spawn` reconfiguration mechanism, which is what keeps the old and new processes connected long enough to send data between them. It is the default, so the build from [Julia Hello World](hello-world#step-3-build-dmr-inside-the-cluster) already has it.

## Step 3: Run the example

```bash
srun -N1 --exclusive tests/integration/run_test.sh dataset.jl
```

As with the hello world, the job starts on one node and DMR adds and removes nodes as the program asks for them.

### Reading the output

Among DMR's own `[RANK0:...]` and `[DMR ANALYTICS]` lines, the example prints its own `[julia]` lines:

```text
[julia] generation reconfig=0 nodes=1 world_size=1: 1024 elements validated, 1024 on rank 0
[julia] expanding 1 -> 2 processes, redistributing 1024 elements
[julia] generation reconfig=1 nodes=2 world_size=2: 1024 elements validated, 512 on rank 0
[julia] expanding 2 -> 3 processes, redistributing 1024 elements
[julia] generation reconfig=2 nodes=3 world_size=3: 1024 elements validated, 342 on rank 0
[julia] shrinking 3 -> 2 processes, redistributing 1024 elements
[julia] generation reconfig=3 nodes=2 world_size=2: 1024 elements validated, 512 on rank 0
[julia] shrinking 2 -> 1 processes, redistributing 1024 elements
[julia] generation reconfig=4 nodes=1 world_size=1: 1024 elements validated, 1024 on rank 0
[julia] last generation, nothing left to reconfigure
[julia] end of generation 4
Exit code: 0
```

`1024 elements validated` means every process checked its piece of the array after the move. The last number shows how the array is split: with 1 process, rank 0 holds all 1024 elements; with 2, 512 each; with 3, 342 + 341 + 341.

## Step 4: Stop the cluster

```bash
exit
minidmr stop
```

## How the data moves

The data is sent through DMR's *intercommunicator*: an MPI communicator that connects the processes of the old generation with those of the new one during a reconfiguration. See [Data Redistribution](../../user-guide/data-redistribution#intercommunicator) for the full picture.

The program gives DMR two functions, one for each side of the move:

```julia
# New generation: receive the data before doing anything else.
dmr_init(restart = () -> (received[] = receive_dataset()))

# ...

# Old generation: when DMR reconfigures, send the data out first.
action = DMRBindings.dmr_check(DMRBindings.SHOULD_EXPAND)
dmr_auto(action; redist = () -> send_dataset(data))
```

- `redist` runs on the old processes, just before they end. `send_dataset` gets the intercommunicator with `dmr_intercomm()` and sends each piece to the new process that will own it.
- `restart` runs on the new processes, inside `dmr_init`. `receive_dataset` gets the same intercommunicator and receives its piece.

Both sides use a single `MPI_Alltoallv`: each process works out which part of its range overlaps with each process on the other side, and sends or receives exactly that.

`MPI.jl`'s high-level `Alltoallv!` assumes a normal communicator, where the counts are indexed by the local processes. On an intercommunicator they are indexed by the processes on the other side, so the program calls the C function directly, through `MPI.API.MPI_Alltoallv`.

## Key points

- `dmr_intercomm()` only works inside the `redist` and `restart` functions, while the two generations are connected.
- Checking every element after every move means a redistribution bug fails right away instead of silently corrupting data.
- The array size does not need to divide evenly by the number of processes: the first processes take one extra element each.
- This example moves data in memory only. The C [Distributed Dataset](../c/distributed-dataset) also shows how to do it through files.
