---
sidebar_position: 4
title: Python Bindings
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

The `dmr` Python package gives Python programs access to DMR's C API, so an `mpi4py` program can grow and shrink while it runs. It lives in its own repository, [`python-dmr`](https://gitlab.bsc.es/accelcom/releases/dmr/tools/python-dmr), separate from DMR itself.

The package is pure Python on top of `ctypes`: nothing is compiled when it is installed, and the only thing it needs from DMR at run time is an installed `libdmr.so`. The same package works on any machine, against the DMR built for that machine.

## Installing

### 1. DMR

The package needs a built DMR, with `$DMR_PATH` pointing at its install prefix (`$DMR_PATH/lib/libdmr.so`), or `libdmr.so` on the library search path. See [Installation](../getting-started/installation), or use `module load dmr` on MN5. `import dmr` works without it; the first call into DMR fails with instructions.

### 2. Python and mpi4py

Python 3.10 or newer. `mpi4py` must be built against the MPI that DMR was built with, which is not the MPI the binary wheel brings. Build it from source in your environment:

```bash
python -m venv .venv && source .venv/bin/activate
MPICC=$(which mpicc) pip install --no-binary mpi4py "mpi4py>=4.0"
```

### 3. The package

```bash
pip install git+https://gitlab.bsc.es/accelcom/releases/dmr/tools/python-dmr.git
```

Or, to work on the bindings themselves, `pip install -e /path/to/python-dmr` from a local clone.

## Running an example on MiniDMR

The repository ships two complete malleable programs under `tests/e2e/apps/`, which are also its end-to-end tests:

- `hello_world.py` grows from 1 to 3 nodes and shrinks back to 1, without moving any data. See [Python Hello World](../examples/python-hello-world).
- `dataset.py` does the same while redistributing a dataset over DMR's intercommunicator. See [Python Distributed Dataset](../examples/python-distributed-dataset).

The quickest way to run them is a local [MiniDMR](../user-guide/minidmr) cluster. DMR is built *inside* the cluster from the `dmr/` submodule, which pins the DMR commit the bindings are tested against. The MiniDMR image only ships Python 3.6, so a setup script fetches a recent CPython and builds a virtualenv with `mpi4py` and the package, all under `build/` in the repository. Nothing but Docker and MiniDMR is needed on the host.

Clone the repository with its submodule, somewhere under `$HOME` (MiniDMR mounts `$HOME` into every node, which is how the nodes see the repository):

```bash
git clone --recurse-submodules https://gitlab.bsc.es/accelcom/releases/dmr/tools/python-dmr.git ~/python-dmr
cd ~/python-dmr
```

<Tabs groupId="bindings-run">
  <TabItem value="just" label="One command">

`nix develop` gives `just` and `minidmr`. Then:

```bash
nix develop
just e2e               # both programs
just e2e -k dataset    # only one of them (arguments go to pytest)
```

`just e2e` starts a 4-node cluster, builds and installs DMR into `build/install`, prepares the virtualenv in `build/e2e`, runs both programs through `pytest`, and stops the cluster on exit, whether they pass or fail. A program passes only if the generations it logs ran on exactly 1, 2, 3, 2 and 1 nodes.

  </TabItem>
  <TabItem value="manual" label="Step by step">

Start a cluster. The programs grow to 3 nodes, so ask for at least that many:

```bash
minidmr start --nodes 4 -i registry.gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr:dmr-3.0.0
```

Build DMR from the submodule inside the cluster, so it runs against the container's compiler, MPI and PMIx:

```bash
minidmr exec -- bash -c '
    cmake -B build/dmr -S dmr -DCMAKE_INSTALL_PREFIX=$(pwd)/build/install &&
    cmake --build build/dmr -j8 &&
    cmake --install build/dmr'
```

Prepare the Python environment (CPython, a virtualenv, `mpi4py` built against the container's MPI, and this package). It only builds what is missing, so rerunning it is cheap:

```bash
minidmr exec -- tests/e2e/setup_env.sh
```

Run a program in its own Slurm allocation with `tests/e2e/run_app.sh`:

```bash
minidmr exec -- bash -c '
    export DMR_PATH=$(pwd)/build/install
    export E2E_PYTHON=$(pwd)/build/e2e/venv/bin/python
    srun -N1 --exclusive tests/e2e/run_app.sh hello_world.py'
```

Stop the cluster when you are done:

```bash
minidmr stop
```

  </TabItem>
</Tabs>

The job starts on one node and DMR asks Slurm for the rest. Rank 0 prints one `[py]` line per event, between DMR's own debug and analytics output:

```text
[py] generation reconfig=0 nodes=1 world_size=1
[py] expanding 1 -> 2 nodes
[py] end of generation 0
[py] generation reconfig=1 nodes=2 world_size=2
[py] expanding 2 -> 3 nodes
...
[py] last generation, nothing left to reconfigure
[py] end of generation 4
```

## Writing a malleable program

A DMR program in Python is an ordinary `mpi4py` program, structured around `dmr.init` and `dmr.auto`:

```python
from mpi4py import MPI   # initializes MPI, which DMR adopts
import dmr

dmr.init(restart=receive_data)   # in a new generation, runs restart first

while work_left():
    step()
    dmr.set_nodes_next_expand(1)
    dmr.auto(dmr.check(dmr.Suggestion.SHOULD_EXPAND),
             redist=send_data)   # this generation's processes end here on a resize

dmr.auto(dmr.finalize())
```

- `dmr.init` and `dmr.auto` take the same three optional callbacks as [`DMR_AUTO`](core-api) in C: `redist` (send data out, on the old generation), `restart` (receive it, on the new one) and `finalize` (release resources on the last one).
- `dmr.auto` ends the process whenever DMR reports that the current generation is done. Code after it does not run in a generation being replaced. It flushes `stdout` and `stderr` first, since DMR exits through C's `exit()` and skips Python's own shutdown.
- Inside `redist` and `restart`, `dmr.intercomm()` returns the intercommunicator between the old and new generations as an `mpi4py` `MPI.Intercomm`. It is only available with DMR's default `spawn` mechanism (`DMR_MECHANISM=spawn`). DMR owns it: do not free or disconnect it.

Launch it through DMR's wrapper, not a plain `mpirun`:

```bash
dmr_wrapper mpirun --host <hosts> -x PATH -x DMR_PATH python myprogram.py
```

- `dmr_wrapper` is mandatory: DMR relaunches the program for every reconfiguration, and the wrapper keeps its state across generations.
- `-x PATH -x DMR_PATH` let the processes DMR spawns for later generations find the same `python` and the same DMR. The relaunch uses the exact interpreter that started the program (`sys.executable`), so a virtualenv's `python` is preserved.

## Mapping from the C API

The Pythonic layer, `dmr.api` (re-exported as `dmr`), is generated from DMR's headers by fixed rules:

| C | Python |
|---|--------|
| `dmr_check(...)` | `dmr.check(...)` |
| `DMRAction`, `DMR_RECONF` | `dmr.Action`, `dmr.Action.RECONF` |
| `DMRSuggestion`, `SHOULD_EXPAND` | `dmr.Suggestion`, `dmr.Suggestion.SHOULD_EXPAND` |
| Function returning `DMRStatus` | Raises `dmr.DMRError` on failure, returns the status otherwise. `ERROR_NOT_ROOT` is not a failure: ranks other than 0 get it from the setters only rank 0 acts on. |
| `const char *` | `str` |
| `int argc, char *argv[]` | `list[str]` |
| `dmr_get_*(T *out)` | Returns `T`, as a frozen dataclass |
| Pointer returning `NULL` | `None` |

The C API is also available one to one, with C names and `ctypes` types, in `dmr._raw`.

## Limitations

- **Policies written in Python are not supported yet.** A policy callback returns a `DMRPolicySuggestion` by value, and `ctypes` cannot create callbacks that return a struct. The built-in policies work (`dmr.get_policy_list()`, `dmr.set_policy(...)`), as does [manual control](../user-guide/policies/manual-control).

## How the bindings are built

Almost everything is generated from DMR's public headers by `tools/generate.py` (libclang) and committed, so an API change in DMR shows up as a diff. A signature that no rule covers fails generation instead of being dropped. The few pieces that cannot be generated are hand written in `src/dmr/lifecycle.py` and `src/dmr/_lib.py`:

| Piece | Why it cannot be generated |
|-------|----------------------------|
| `dmr.auto` | `DMR_AUTO` is a preprocessor macro, and no FFI sees macros. This is its transcription, branch by branch. |
| `dmr.init` / `dmr.default_argv` | DMR relaunches `argv[0]` as the next generation. For Python that has to be the interpreter, not the script. |
| `dmr.intercomm` | `DMR_INTERCOMM` is an `extern` variable, read with `ctypes` and wrapped as an `mpi4py` intercommunicator. |
| Loading `libdmr.so` | Found through `$DMR_PATH/lib`, and opened `RTLD_GLOBAL` so that Slurm's plugins can resolve their symbols. |

For development, `nix develop` provides Python with libclang, `pytest`, `ruff`, `just` and `minidmr`:

```bash
just gen        # regenerate src/dmr/_raw.py and src/dmr/api.py from dmr/include
just gen-check  # fail if they are behind dmr/include
just unit       # host-side unit tests, no cluster
just e2e        # MiniDMR end-to-end tests
just test       # all of the above, plus lint
```
