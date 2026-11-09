---
sidebar_position: 1
sidebar_label: Hello World
title: Julia Hello World
---

A minimal malleable program written in Julia with the [Julia Bindings](../../user-guide/bindings/julia). It grows from 1 to 3 nodes and shrinks back to 1, without moving any application data, so you can see a DMR reconfiguration from Julia end to end.

Source: [`tests/integration/hello_world.jl`](https://gitlab.bsc.es/accelcom/releases/dmr/tools/julia-dmr/-/blob/main/tests/integration/hello_world.jl) in the `julia-dmr` repository.

## What it does

1. Initialises MPI and DMR.
2. Asks DMR for one more node, waits until it is granted, and lets DMR relaunch the program on the bigger allocation.
3. Repeats until it runs on 3 nodes, then asks DMR to release one node at a time until it is back on 1.
4. Prints one line per generation (each relaunch of the program), so you can follow the node count: 1 &rarr; 2 &rarr; 3 &rarr; 2 &rarr; 1.

## Prerequisites

You only need three things on your machine:

- **Docker** and **[MiniDMR](../../user-guide/minidmr)**, which together give you a small Slurm cluster in containers.
- **Julia**, installed with [juliaup](https://github.com/JuliaLang/juliaup):

  ```bash
  curl -fsSL https://install.julialang.org | sh
  ```

  juliaup installs Julia under `~/.juliaup`. MiniDMR mounts your `$HOME` into every node of the cluster, so the nodes use this same Julia and you do not have to install it inside the containers.

DMR itself is built inside the cluster in [step 3](#step-3-build-dmr-inside-the-cluster).

## Step 1: Get the code

Clone the `julia-dmr` repository with its submodule. Clone it somewhere under your `$HOME`, so that the cluster nodes can see it:

```bash
git clone --recurse-submodules https://gitlab.bsc.es/accelcom/releases/dmr/tools/julia-dmr.git ~/julia-dmr
cd ~/julia-dmr
```

The repository contains the bindings (`src/`), the example programs (`tests/integration/`), and DMR's own sources in `dmr/`, pinned to the version the bindings are tested against.

## Step 2: Start a local cluster

From the `julia-dmr` directory, start a 4-node cluster. The program grows to 3 nodes, so the cluster needs at least that many:

```bash
minidmr start --nodes 4 -i registry.gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr:dmr-3.0.0
```

Then open a shell on the cluster's controller node:

```bash
minidmr enter
```

You land in the same `julia-dmr` directory, now inside the cluster. The rest of the commands, until [step 6](#step-6-stop-the-cluster), run here.

## Step 3: Build DMR inside the cluster

The MiniDMR image already ships its compiler, MPI and PMIx, which is what DMR has to be built against. Build DMR from the `dmr/` submodule and install it inside the repository, in `build/install`:

```bash
cmake -B build/dmr -S dmr -DCMAKE_INSTALL_PREFIX=$(pwd)/build/install
cmake --build build/dmr -j8
cmake --install build/dmr
```

Then tell the bindings where it is. `DMR_PATH` is how both DMR's tools and the Julia package find the library:

```bash
export DMR_PATH=$(pwd)/build/install
```

:::note
The image also has an older DMR preinstalled under `/usr/local`. Building from the submodule makes sure the bindings run against the DMR version they were generated from.
:::

## Step 4: Set up the Julia environment

This is done once. Put Julia on the `PATH` and install the package's dependencies:

```bash
export PATH=$HOME/.juliaup/bin:$PATH
julia -t 1 --project=. -e 'using Pkg; Pkg.instantiate()'
```

Then point `MPI.jl` at the cluster's MPI. By default `MPI.jl` uses its own bundled MPI, which cannot take part in the MPI jobs that DMR launches:

```bash
julia -t 1 --project=. -e 'using MPIPreferences; MPIPreferences.use_system_binary(library_names=["/usr/local/lib/libmpi"], mpiexec="/usr/local/bin/mpiexec", abi="OpenMPI")'
```

This creates a `LocalPreferences.toml` file next to `Project.toml`. Either command may print a segfault at the very end, after having done its job; what matters is that `LocalPreferences.toml` is there afterwards.

## Step 5: Run the example

Submit the program as a one-node Slurm job:

```bash
srun -N1 --exclusive tests/integration/run_test.sh hello_world.jl
```

The job starts on a single node. While it runs, the program asks DMR for more nodes, and DMR gets them from Slurm, so the job grows beyond the one node you asked for.

`run_test.sh` takes care of the launch command. It turns the Slurm allocation into a host list and runs:

```bash
dmr_wrapper mpirun --host <hosts> -x PATH -x DMR_PATH \
    julia -t 1 --project=. tests/integration/hello_world.jl
```

- `dmr_wrapper` is required: DMR relaunches the program on every reconfiguration, and the wrapper keeps DMR's state between those relaunches.
- `-x PATH -x DMR_PATH` pass your environment to the processes DMR starts later, so they find the same `julia` and the same DMR.
- `-t 1` runs Julia with a single thread, which avoids a crash in Julia's task scheduler when the process exits.

### Reading the output

The script turns on DMR's debug and analytics output (`DMR_DEBUG_LEVEL=3`, `DMR_PRINT_ANALYTICS=1`), so you will see many lines starting with `[RANK0:...]` and `[DMR ANALYTICS]`. Those show what DMR is doing: asking Slurm for nodes, waiting for them, relaunching the program. The lines the example prints itself start with `[julia]`:

```text
[julia] generation reconfig=0 nodes=1 world_size=1
[julia] expanding 1 -> 2 nodes
[julia] generation reconfig=1 nodes=2 world_size=2
[julia] expanding 2 -> 3 nodes
[julia] generation reconfig=2 nodes=3 world_size=3
[julia] shrinking 3 -> 2 nodes
[julia] generation reconfig=3 nodes=2 world_size=2
[julia] shrinking 2 -> 1 nodes
[julia] generation reconfig=4 nodes=1 world_size=1
[julia] last generation, nothing left to reconfigure
[julia] end of generation 4, world_size=1
Exit code: 0
```

Each `generation` line is a new launch of the program: `reconfig` counts the reconfigurations so far, `nodes` is the node count of that generation, and `world_size` is the number of MPI processes (one per node here). After `expanding` or `shrinking`, the old generation ends and the next `generation` line comes from the relaunched program.

To print only the example's lines, filter the output:

```bash
srun -N1 --exclusive tests/integration/run_test.sh hello_world.jl | grep '^\[julia\]'
```

## Step 6: Stop the cluster

Leave the controller and stop the cluster:

```bash
exit
minidmr stop
```

Next time, you can skip steps 1, 3 and 4: start the cluster, enter it, set `DMR_PATH` and `PATH` again, and run.

## How the code works

Stripped of logging and error checks, the program is:

```julia
using MPI, DMR

MPI.Init()
dmr_init()                                       # (1)

reconfigs = DMRBindings.dmr_get_reconfig_count() # (2)
nodes = DMRBindings.dmr_get_current_node_count()
next = expected_size(reconfigs + 1)              # 1, 2, 3, 2, 1

if next > nodes
    DMRBindings.dmr_set_nodes_next_expand(Cint(next - nodes))   # (3)
    reconfigure!(DMRBindings.SHOULD_EXPAND)                     # (4)
elseif 0 < next < nodes
    DMRBindings.dmr_set_nodes_next_shrink(Cint(nodes - next))
    reconfigure!(DMRBindings.SHOULD_SHRINK)
end

dmr_auto(DMRBindings.dmr_finalize())             # (5)
MPI.Finalize()
exit(0)
```

1. `dmr_init()` connects the program to DMR. In a relaunched generation, this is also where DMR would hand over data from the previous one; this example has none.
2. Every generation runs the program from the top. `dmr_get_reconfig_count()` tells it how many reconfigurations have already happened, which is how it knows where it is in the 1, 2, 3, 2, 1 sequence.
3. The program decides the next size itself, with [manual control](../../user-guide/policies/manual-control): it tells DMR how many nodes to add or remove.
4. `reconfigure!` calls `dmr_check` until DMR answers with an action, then hands that action to `dmr_auto`. Requests to Slurm are asynchronous, so the first answers are usually "no action yet" while Slurm grants the nodes. When the reconfiguration happens, `dmr_auto` ends this generation, and DMR relaunches the program on the new nodes.
5. In the last generation, `dmr_finalize` closes DMR, and `exit(0)` ends the process explicitly, because Julia can crash during its own shutdown after `MPI.Finalize()`.

Functions that come straight from DMR's C API, such as `dmr_check` or `dmr_get_reconfig_count`, are in the `DMRBindings` module with the same names as in the [Core API](../../api/core-api). `dmr_init` and `dmr_auto` are written by hand in Julia; see [Julia Bindings](../../user-guide/bindings/julia#how-the-bindings-are-built) for why.

## Key points

- Every reconfiguration relaunches the program. Anything you need to keep across a resize has to be passed explicitly, which is what [Julia Distributed Dataset](distributed-dataset) shows.
- `dmr_check` is polled every 2 seconds, up to 30 times. If DMR never acts, the program cancels the pending request instead of leaving nodes reserved.
- The functions that set the next size only act on rank 0. The other ranks get `DMR_ERROR_NOT_ROOT` back, which the program treats as success.
