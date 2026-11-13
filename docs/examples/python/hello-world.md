---
sidebar_position: 1
sidebar_label: Hello World
title: Python Hello World
---

A minimal malleable program written in Python with the [Python Bindings](../../user-guide/bindings/python). It grows from 1 to 3 nodes and shrinks back to 1, without moving any application data, so you can see a DMR reconfiguration from Python end to end.

Source: [`tests/e2e/apps/hello_world.py`](https://gitlab.bsc.es/accelcom/releases/dmr/bindings/python-dmr/-/blob/master/tests/e2e/apps/hello_world.py) in the `python-dmr` repository, with small helpers in `common.py` next to it.

## What it does

1. Initialises MPI (through `mpi4py`) and DMR.
2. Asks DMR for one more node, waits until it is granted, and lets DMR relaunch the program on the bigger allocation.
3. Repeats until it runs on 3 nodes, then asks DMR to release one node at a time until it is back on 1.
4. Prints one line per generation (each relaunch of the program), so you can follow the node count: 1 &rarr; 2 &rarr; 3 &rarr; 2 &rarr; 1.

## Prerequisites

You only need **Docker** and **[MiniDMR](../../user-guide/minidmr)** on your machine, which together give you a small Slurm cluster in containers. Python, `mpi4py` and DMR itself are all set up inside the cluster in the steps below.

## Step 1: Get the code

Clone the `python-dmr` repository with its submodule. Clone it somewhere under your `$HOME`: MiniDMR mounts `$HOME` into every node of the cluster, which is how the nodes see the code.

```bash
git clone --recurse-submodules https://gitlab.bsc.es/accelcom/releases/dmr/bindings/python-dmr.git ~/python-dmr
cd ~/python-dmr
```

The repository contains the bindings (`src/dmr/`), the example programs (`tests/e2e/apps/`), and DMR's own sources in `dmr/`, pinned to the version the bindings are tested against.

## Step 2: Start a local cluster

From the `python-dmr` directory, start a 4-node cluster. The program grows to 3 nodes, so the cluster needs at least that many:

```bash
minidmr start --nodes 4 -i registry.gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr:dmr-3.0.0
```

Then open a shell on the cluster's controller node:

```bash
minidmr enter
```

You land in the same `python-dmr` directory, now inside the cluster. The rest of the commands, until [step 6](#step-6-stop-the-cluster), run here.

## Step 3: Build DMR inside the cluster

The MiniDMR image already ships its compiler, MPI and PMIx, which is what DMR has to be built against. Build DMR from the `dmr/` submodule and install it inside the repository, in `build/install`:

```bash
cmake -B build/dmr -S dmr -DCMAKE_INSTALL_PREFIX=$(pwd)/build/install
cmake --build build/dmr -j8
cmake --install build/dmr
```

Then tell the bindings where it is. `DMR_PATH` is how both DMR's tools and the Python package find the library:

```bash
export DMR_PATH=$(pwd)/build/install
```

:::note
The image also ships a prebuilt DMR under `/usr/local`, which is what the C examples use. Building from the submodule makes sure the bindings run against exactly the DMR version they were generated from.
:::

## Step 4: Set up Python

This is done once. The MiniDMR image only ships Python 3.6, and the bindings need 3.10 or newer, so the repository includes a script that prepares everything under `build/e2e/`:

```bash
tests/e2e/setup_env.sh
```

It downloads [uv](https://docs.astral.sh/uv/) and a recent Python, creates a virtual environment in `build/e2e/venv`, and installs two things into it:

- `mpi4py`, **compiled against the cluster's MPI**. The prebuilt `mpi4py` packages bring their own MPI, which cannot take part in the MPI jobs that DMR launches.
- The `dmr` package from this repository.

It ends by printing where `dmr` and `mpi4py` were installed. Running it again is cheap: it only rebuilds what is missing.

## Step 5: Run the example

Tell the run script which Python to use, and submit the program as a one-node Slurm job:

```bash
export E2E_PYTHON=$(pwd)/build/e2e/venv/bin/python
srun -N1 --exclusive tests/e2e/run_app.sh hello_world.py
```

The job starts on a single node. While it runs, the program asks DMR for more nodes, and DMR gets them from Slurm, so the job grows beyond the one node you asked for.

`run_app.sh` takes care of the launch command. It turns the Slurm allocation into a host list and runs:

```bash
dmr mpirun --host <hosts> -x PATH -x DMR_PATH \
    build/e2e/venv/bin/python tests/e2e/apps/hello_world.py
```

- `dmr` is required: DMR relaunches the program on every reconfiguration, and the wrapper keeps DMR's state between those relaunches.
- `-x PATH -x DMR_PATH` pass your environment to the processes DMR starts later, so they find the same DMR. DMR relaunches the exact Python that started the program, so every generation runs in the same virtual environment.

### Reading the output

The script turns on DMR's debug and analytics output (`DMR_DEBUG_LEVEL=3`, `DMR_PRINT_ANALYTICS=1`), so you will see many lines starting with `[RANK0:...]` and `[DMR ANALYTICS]`. Those show what DMR is doing: asking Slurm for nodes, waiting for them, relaunching the program. The lines the example prints itself start with `[py]`:

```text
[py] generation reconfig=0 nodes=1 world_size=1
[py] expanding 1 -> 2 nodes
[py] generation reconfig=1 nodes=2 world_size=2
[py] expanding 2 -> 3 nodes
[py] generation reconfig=2 nodes=3 world_size=3
[py] shrinking 3 -> 2 nodes
[py] generation reconfig=3 nodes=2 world_size=2
[py] shrinking 2 -> 1 nodes
[py] generation reconfig=4 nodes=1 world_size=1
[py] last generation, nothing left to reconfigure
[py] end of generation 4
```

Each `generation` line is a new launch of the program: `reconfig` counts the reconfigurations so far, `nodes` is the node count of that generation, and `world_size` is the number of MPI processes (one per node here). After `expanding` or `shrinking`, the old generation ends and the next `generation` line comes from the relaunched program.

To print only the example's lines, filter the output:

```bash
srun -N1 --exclusive tests/e2e/run_app.sh hello_world.py 2>&1 | grep '^\[py\]'
```

## Step 6: Stop the cluster

Leave the controller and stop the cluster:

```bash
exit
minidmr stop
```

Next time, you can skip steps 1, 3 and 4: start the cluster, enter it, set `DMR_PATH` and `E2E_PYTHON` again, and run.

## How the code works

Stripped of logging, the program is:

```python
from mpi4py import MPI                    # (1)
import dmr

dmr.init()                                # (2)

reconfigs = dmr.get_reconfig_count()      # (3)
nodes = dmr.get_current_node_count()
target = expected_size(reconfigs + 1)     # 1, 2, 3, 2, 1

if target > nodes:
    dmr.set_nodes_next_expand(target - nodes)      # (4)
    reconfigure(dmr.Suggestion.SHOULD_EXPAND)      # (5)
elif 0 < target < nodes:
    dmr.set_nodes_next_shrink(nodes - target)
    reconfigure(dmr.Suggestion.SHOULD_SHRINK)

dmr.auto(dmr.finalize())                  # (6)
```

1. Importing `mpi4py.MPI` initialises MPI. DMR uses that same MPI.
2. `dmr.init()` connects the program to DMR. In a relaunched generation, this is also where DMR would hand over data from the previous one; this example has none.
3. Every generation runs the program from the top. `dmr.get_reconfig_count()` tells it how many reconfigurations have already happened, which is how it knows where it is in the 1, 2, 3, 2, 1 sequence.
4. The program decides the next size itself, with [manual control](../../user-guide/policies/manual-control): it tells DMR how many nodes to add or remove.
5. `reconfigure` (in `common.py`) calls `dmr.check` until DMR answers with an action, then hands that action to `dmr.auto`. Requests to Slurm are asynchronous, so the first answers are usually `NO_ACTION` while Slurm grants the nodes. When the reconfiguration happens, `dmr.auto` ends this generation, and DMR relaunches the program on the new nodes.
6. In the last generation, `dmr.finalize()` closes DMR and ends the process.

The Python names follow DMR's C API without the `dmr_` prefix: `dmr_check` is `dmr.check`, `SHOULD_EXPAND` is `dmr.Suggestion.SHOULD_EXPAND`. Errors raise `dmr.DMRError` instead of returning a status. See [Python Bindings](../../user-guide/bindings/python#mapping-from-the-c-api) for the full mapping.

## Key points

- Every reconfiguration relaunches the program. Anything you need to keep across a resize has to be passed explicitly, which is what [Python Distributed Dataset](distributed-dataset) shows.
- `dmr.check` is polled every 2 seconds, up to 30 times. If DMR never acts, the program cancels the pending request instead of leaving nodes reserved.
- The functions that set the next size only act on rank 0. On the other ranks they do nothing, and the bindings do not treat that as an error.
