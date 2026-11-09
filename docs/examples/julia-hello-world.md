---
sidebar_position: 3
title: Julia Hello World
---

A minimal malleable DMR application written against the [Julia Bindings](../api/julia-bindings), showing how a resize plays out without transferring any application data.

Source: [`tests/integration/hello_world.jl`](https://gitlab.bsc.es/accelcom/releases/dmr/tools/julia-dmr/-/blob/main/tests/integration/hello_world.jl) in the `julia-dmr` repository. It is also one of the bindings' integration tests.

## What it does

1. Initialises MPI and DMR with `MPI.Init()` and `dmr_init()`.
2. Grows one node at a time up to `GROW_TO = 3`, then shrinks back to one, one reconfiguration per generation. It mirrors DMR's C test `tests/integration/manual_resize/test_linear_proc_reconfig.c`.
3. Drives the resize itself with `dmr_set_nodes_next_expand`/`dmr_set_nodes_next_shrink` and `dmr_check`, using [manual control](../user-guide/policies/manual-control) rather than a registered policy.
4. Polls `dmr_check` until DMR answers with an action, since resource requests are asynchronous by default, and cancels a pending expansion rather than leaking it if the poll gives up.
5. Prints which node count each generation started on.

## The core of it

```julia
using MPI, DMR

MPI.Init()
dmr_init()

reconfigs = DMRBindings.dmr_get_reconfig_count()
nodes = DMRBindings.dmr_get_current_node_count()
next = expected_size(reconfigs + 1)              # 1, 2, 3, 2, 1

if next > nodes
    DMRBindings.dmr_set_nodes_next_expand(Cint(next - nodes))
    reconfigure!(DMRBindings.SHOULD_EXPAND)      # polls dmr_check, then dmr_auto(action)
elseif 0 < next < nodes
    DMRBindings.dmr_set_nodes_next_shrink(Cint(nodes - next))
    reconfigure!(DMRBindings.SHOULD_SHRINK)
end

dmr_auto(DMRBindings.dmr_finalize())
MPI.Finalize()
exit(0)
```

There is no data to move, so `dmr_auto` is called without callbacks, the same way the C tests pass `NULL` for all three.

## Running it

Follow [Running an example on MiniDMR](../api/julia-bindings#running-an-example-on-minidmr), selecting this program:

```bash
git clone --recurse-submodules https://gitlab.bsc.es/accelcom/releases/dmr/tools/julia-dmr.git ~/julia-dmr
cd ~/julia-dmr
nix develop
just int test=hello_world.jl
```

On a real cluster, inside an allocation and with `$DMR_PATH` set and the package installed as described in [Installing](../api/julia-bindings#installing):

```bash
dmr_wrapper mpirun --host <hosts> -x PATH -x DMR_PATH \
    julia -t 1 --project=<julia-dmr checkout> tests/integration/hello_world.jl
```

`tests/integration/run_test.sh` builds that command from `$SLURM_JOB_NODELIST`, with `DMR_PROCS_PER_NODE=1`. The job starts on one node and DMR asks Slurm for two more as it grows, so the allocation must be able to reach three nodes.

## Expected output

`run_test.sh` sets `DMR_DEBUG_LEVEL=3` and `DMR_PRINT_ANALYTICS=1`, so DMR's own debug and analytics lines are interleaved with the `[julia]` lines the program prints. Filtered down to those, rank 0 reports each generation growing 1 &rarr; 2 &rarr; 3 nodes and shrinking back to 1:

```text
[julia] generation reconfig=0 nodes=1 world_size=1
[julia] expanding 1 -> 2 nodes
[julia] end of generation 0, world_size=1
[julia] generation reconfig=1 nodes=2 world_size=2
[julia] expanding 2 -> 3 nodes
[julia] end of generation 1, world_size=2
[julia] generation reconfig=2 nodes=3 world_size=3
[julia] shrinking 3 -> 2 nodes
[julia] end of generation 2, world_size=3
[julia] generation reconfig=3 nodes=2 world_size=2
[julia] shrinking 2 -> 1 nodes
[julia] end of generation 3, world_size=2
[julia] generation reconfig=4 nodes=1 world_size=1
[julia] last generation, nothing left to reconfigure
[julia] end of generation 4, world_size=1
```

## Key points

- Resource requests are asynchronous by default (`DMR_BLOCKING_REQ=0`), so `dmr_check` is polled every 2 seconds, up to 30 times, before the program gives up and cancels the pending request.
- The setters that change the next expand or shrink size act on rank 0 only; every other rank gets `DMR_ERROR_NOT_ROOT` back, which the program treats as success.
- The process exits explicitly with `exit(0)` after `MPI.Finalize()`, because Julia's task scheduler can segfault during its own teardown otherwise. `-t 1` in the launch command avoids the same issue.
