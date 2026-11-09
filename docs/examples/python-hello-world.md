---
sidebar_position: 5
title: Python Hello World
---

A minimal malleable DMR application written against the [Python Bindings](../api/python-bindings), showing how a resize plays out without transferring any application data.

Source: [`tests/e2e/apps/hello_world.py`](https://gitlab.bsc.es/accelcom/releases/dmr/tools/python-dmr/-/blob/master/tests/e2e/apps/hello_world.py) in the `python-dmr` repository, with its helpers in `common.py` next to it. It is also one of the bindings' end-to-end tests.

## What it does

1. Initialises MPI by importing `mpi4py`, then DMR with `dmr.init()`.
2. Grows one node at a time up to `GROW_TO = 3`, then shrinks back to one, one reconfiguration per generation. It mirrors DMR's C test `tests/integration/manual_resize/test_linear_proc_reconfig.c`.
3. Drives the resize itself with `dmr.set_nodes_next_expand`/`dmr.set_nodes_next_shrink` and `dmr.check`, using [manual control](../user-guide/policies/manual-control) rather than a registered policy.
4. Polls `dmr.check` until DMR answers with an action, since resource requests are asynchronous by default, and cancels a pending expansion rather than leaking it if the poll gives up.
5. Prints which node count each generation started on.

## The core of it

```python
from mpi4py import MPI
import dmr

dmr.init()

reconfigs = dmr.get_reconfig_count()
nodes = dmr.get_current_node_count()
target = expected_size(reconfigs + 1)            # 1, 2, 3, 2, 1

if target > nodes:
    dmr.set_nodes_next_expand(target - nodes)
    reconfigure(dmr.Suggestion.SHOULD_EXPAND)    # polls dmr.check, then dmr.auto(action)
elif 0 < target < nodes:
    dmr.set_nodes_next_shrink(nodes - target)
    reconfigure(dmr.Suggestion.SHOULD_SHRINK)

dmr.auto(dmr.finalize())
```

There is no data to move, so `dmr.auto` is called without callbacks. Unlike the C API, the setters raise `dmr.DMRError` on failure instead of returning a status to check.

## Running it

Follow [Running an example on MiniDMR](../api/python-bindings#running-an-example-on-minidmr), selecting this program:

```bash
git clone --recurse-submodules https://gitlab.bsc.es/accelcom/releases/dmr/tools/python-dmr.git ~/python-dmr
cd ~/python-dmr
nix develop
just e2e -k hello_world
```

On a real cluster, inside an allocation and with `$DMR_PATH` set and the package installed as described in [Installing](../api/python-bindings#installing):

```bash
cd tests/e2e/apps
dmr_wrapper mpirun --host <hosts> -x PATH -x DMR_PATH python hello_world.py
```

`tests/e2e/run_app.sh` builds that command from `$SLURM_JOB_NODELIST`, with `DMR_PROCS_PER_NODE=1`. The job starts on one node and DMR asks Slurm for two more as it grows, so the allocation must be able to reach three nodes.

## Expected output

`run_app.sh` sets `DMR_DEBUG_LEVEL=3` and `DMR_PRINT_ANALYTICS=1`, so DMR's own debug and analytics lines are interleaved with the `[py]` lines the program prints. Filtered down to those, rank 0 reports each generation growing 1 &rarr; 2 &rarr; 3 nodes and shrinking back to 1:

```text
[py] generation reconfig=0 nodes=1 world_size=1
[py] expanding 1 -> 2 nodes
[py] end of generation 0
[py] generation reconfig=1 nodes=2 world_size=2
[py] expanding 2 -> 3 nodes
[py] end of generation 1
[py] generation reconfig=2 nodes=3 world_size=3
[py] shrinking 3 -> 2 nodes
[py] end of generation 2
[py] generation reconfig=3 nodes=2 world_size=2
[py] shrinking 2 -> 1 nodes
[py] end of generation 3
[py] generation reconfig=4 nodes=1 world_size=1
[py] last generation, nothing left to reconfigure
[py] end of generation 4
```

## Key points

- Resource requests are asynchronous by default (`DMR_BLOCKING_REQ=0`), so `dmr.check` is polled every 2 seconds, up to 30 times, before the program gives up and cancels the pending request.
- The setters act on rank 0 only. Other ranks get `ERROR_NOT_ROOT`, which the bindings do not treat as an error.
- DMR relaunches the exact interpreter that started the program (`sys.executable`), so running it from a virtualenv keeps every generation in that virtualenv.
