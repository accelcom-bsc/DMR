---
sidebar_position: 6
title: Python Distributed Dataset
---

A malleable Python application that keeps a distributed dataset consistent across reconfigurations, moving it over DMR's intercommunicator through the [Python Bindings](../api/python-bindings). It is the Python counterpart of [Distributed Dataset](distributed-dataset), restricted to the in-memory transfer.

Source: [`tests/e2e/apps/dataset.py`](https://gitlab.bsc.es/accelcom/releases/dmr/tools/python-dmr/-/blob/master/tests/e2e/apps/dataset.py) in the `python-dmr` repository. It is also one of the bindings' end-to-end tests.

## What it does

1. Splits a dataset of `SIZE = 1024` elements across ranks, giving the first `SIZE % n` ranks one extra element. Element `i` is the number `i`, so each rank can validate its slice by comparing it against the range it should own.
2. Initialises DMR with `dmr.init(restart=...)`, whose callback receives the dataset over `dmr.intercomm()` before anything else runs.
3. Grows one process at a time up to `GROW_TO = 3`, then shrinks back to one, using [manual control](../user-guide/policies/manual-control) the same way as [Python Hello World](python-hello-world).
4. On every reconfiguration, sends the dataset to the next generation with a single `Alltoallv` over the intercommunicator, from a `redist` callback passed to `dmr.auto`.
5. Validates the data it received at the start of every generation, and aborts on any mismatch.

## Redistribution over the intercommunicator

The program uses the intercommunicator transfer described in [Data Redistribution](../user-guide/data-redistribution#intercommunicator): old and new processes are alive at the same time for a short window, and the old ones send their data directly to the new ones.

```python
received = []
dmr.init(restart=lambda: received.append(receive_dataset()))   # new generation
...
dmr.auto(dmr.check(dmr.Suggestion.SHOULD_EXPAND),
         redist=lambda: send_dataset(data))                     # old generation
```

Both callbacks get the intercommunicator from `dmr.intercomm()`, an ordinary `mpi4py` `MPI.Intercomm`, and exchange the overlapping ranges of the old and new layouts:

```python
def send_dataset(data):
    comm = dmr.intercomm()
    remote = comm.Get_remote_size()
    counts, displs = overlap(my_offset, len(data), remote)
    nothing = [0] * remote
    comm.Alltoallv([data, (counts, displs), MPI.DOUBLE],
                   [array("d"), (nothing, nothing), MPI.DOUBLE])
```

`dmr.intercomm()` is only valid inside the `redist` and `restart` callbacks, and only with DMR's `spawn` mechanism (`DMR_MECHANISM=spawn`, the default). DMR owns the communicator: do not free or disconnect it.

## Running it

Follow [Running an example on MiniDMR](../api/python-bindings#running-an-example-on-minidmr), selecting this program. DMR is built there with its defaults, which include the `spawn` mechanism:

```bash
git clone --recurse-submodules https://gitlab.bsc.es/accelcom/releases/dmr/tools/python-dmr.git ~/python-dmr
cd ~/python-dmr
nix develop
just e2e -k dataset
```

On a real cluster, the launch command is the same as for [Python Hello World](python-hello-world#running-it), with `dataset.py` as the script, against a DMR built with `DMR_MECHANISM=spawn`.

## Expected output

Filtered down to the `[py]` lines, the dataset is validated at the start of every generation, growing 1 &rarr; 2 &rarr; 3 processes and shrinking back to 1:

```text
[py] generation reconfig=0 world_size=1: 1024 elements validated
[py] expanding 1 -> 2 processes
[py] end of generation 0
[py] generation reconfig=1 world_size=2: 1024 elements validated
[py] expanding 2 -> 3 processes
[py] end of generation 1
[py] generation reconfig=2 world_size=3: 1024 elements validated
[py] shrinking 3 -> 2 processes
[py] end of generation 2
...
[py] last generation, nothing left to reconfigure
```

## Key points

- Every element is checked after every reconfiguration, so a redistribution bug fails fast instead of silently corrupting data. A rank with wrong data calls `MPI.COMM_WORLD.Abort(1)` rather than exiting, which would leave the other ranks waiting.
- `SIZE` does not need to be divisible by the world size: the split hands out the remainder one element at a time.
- The program only implements the intercommunicator transfer, not checkpoint files: it is the Python analogue of the in-memory build of the C [`distributed-dataset-sleep`](distributed-dataset) example.
