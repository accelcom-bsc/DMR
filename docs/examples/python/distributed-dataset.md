---
sidebar_position: 2
sidebar_label: Distributed Dataset
title: Python Distributed Dataset
---

A malleable Python program that keeps a distributed array consistent while the job grows and shrinks. On every reconfiguration, the old processes send their part of the array directly to the new ones over MPI, and the new ones check that every element arrived. It is the Python counterpart of [Distributed Dataset](../c/distributed-dataset).

Source: [`tests/e2e/apps/dataset.py`](https://gitlab.bsc.es/accelcom/releases/dmr/bindings/python-dmr/-/blob/master/tests/e2e/apps/dataset.py) in the `python-dmr` repository.

:::tip
Run [Python Hello World](hello-world) first. This example uses the same cluster, the same DMR build and the same Python environment, so if you have done that one, you can go straight to [step 3](#step-3-run-the-example).
:::

## What it does

1. Creates an array of 1024 numbers, where element `i` is the number `i`, and splits it across the MPI processes.
2. Grows from 1 to 3 processes and shrinks back to 1, one process at a time.
3. On every reconfiguration, sends each piece of the array from the old processes to the new ones, which split it differently because there are now more or fewer of them.
4. At the start of every generation, checks every element it received, and stops with an error if anything is wrong.

## Step 1: Prepare the cluster

If you do not have a cluster from [Python Hello World](hello-world) running, repeat its [steps 1 to 4](hello-world#step-1-get-the-code): clone the repository, start the cluster, build DMR, and set up Python. In short:

```bash
cd ~/python-dmr
minidmr start --nodes 4 -i registry.gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr:dmr-3.0.0
minidmr enter
```

## Step 2: Set the environment

Inside the controller, point to your DMR build and to the Python environment:

```bash
export DMR_PATH=$(pwd)/build/install
export E2E_PYTHON=$(pwd)/build/e2e/venv/bin/python
```

This example needs DMR's `spawn` reconfiguration mechanism, which is what keeps the old and new processes connected long enough to send data between them. It is the default, so the build from [Python Hello World](hello-world#step-3-build-dmr-inside-the-cluster) already has it.

## Step 3: Run the example

```bash
srun -N1 --exclusive tests/e2e/run_app.sh dataset.py
```

As with the hello world, the job starts on one node and DMR adds and removes processes as the program asks for them.

### Reading the output

Among DMR's own `[RANK0:...]` and `[DMR ANALYTICS]` lines, the example prints its own `[py]` lines:

```text
[py] generation reconfig=0 world_size=1: 1024 elements validated
[py] expanding 1 -> 2 processes
[py] generation reconfig=1 world_size=2: 1024 elements validated
[py] expanding 2 -> 3 processes
[py] generation reconfig=2 world_size=3: 1024 elements validated
[py] shrinking 3 -> 2 processes
[py] generation reconfig=3 world_size=2: 1024 elements validated
[py] shrinking 2 -> 1 processes
[py] generation reconfig=4 world_size=1: 1024 elements validated
[py] last generation, nothing left to reconfigure
[py] end of generation 4
```

`1024 elements validated` means every process checked its piece of the array after the move. If any element were wrong, the program would print which rank holds bad data and abort the job.

## Step 4: Stop the cluster

```bash
exit
minidmr stop
```

## How the data moves

The data is sent through DMR's *intercommunicator*: an MPI communicator that connects the processes of the old generation with those of the new one during a reconfiguration. See [Data Redistribution](../../user-guide/data-redistribution#spawn-intercommunicator) for the full picture.

The program gives DMR two functions, one for each side of the move:

```python
received = []

# New generation: receive the data before doing anything else.
dmr.init(restart=lambda: received.append(receive_dataset()))

# ...

# Old generation: when DMR reconfigures, send the data out first.
dmr.auto(dmr.check(dmr.Suggestion.SHOULD_EXPAND),
         redist=lambda: send_dataset(data))
```

- `redist` runs on the old processes, just before they end. `send_dataset` gets the intercommunicator with `dmr.intercomm()` and sends each piece to the new process that will own it.
- `restart` runs on the new processes, inside `dmr.init`. `receive_dataset` gets the same intercommunicator and receives its piece.

`dmr.intercomm()` returns an ordinary `mpi4py` `MPI.Intercomm`, so the move is a single `Alltoallv`. Each process works out which part of its range overlaps with each process on the other side, and sends (or receives) exactly that:

```python
def send_dataset(data):
    comm = dmr.intercomm()
    remote = comm.Get_remote_size()          # processes in the new generation
    counts, displs = overlap(my_offset, len(data), remote)
    nothing = [0] * remote
    comm.Alltoallv([data, (counts, displs), MPI.DOUBLE],
                   [array("d"), (nothing, nothing), MPI.DOUBLE])
```

The receiving side is the mirror image: it sends nothing and receives into a buffer sized for its new piece.

## Key points

- `dmr.intercomm()` only works inside the `redist` and `restart` functions, while the two generations are connected. DMR owns it, so do not free or disconnect it.
- Checking every element after every move means a redistribution bug fails right away instead of silently corrupting data.
- The array size does not need to divide evenly by the number of processes: the first processes take one extra element each.
- This example moves data in memory only. The C [Distributed Dataset](../c/distributed-dataset) also shows how to do it through files.
