---
sidebar_position: 2
sidebar_label: Python
title: Python Bindings
---

The `dmr` Python package gives Python programs access to DMR's C API, so an `mpi4py` program can grow and shrink while it runs. It lives in its own repository, [`python-dmr`](https://gitlab.bsc.es/accelcom/releases/dmr/tools/python-dmr), separate from DMR itself.

The package is pure Python on top of `ctypes`: nothing is compiled when it is installed, and the only thing it needs from DMR at run time is an installed `libdmr.so`. The same package works on any machine, against the DMR built for that machine.

This page explains how to install the bindings and how to write and launch a malleable program. For every function and type, see the [Python API](../../api/python-api) reference.

## Installing

### 1. DMR

The package needs a built DMR, with `$DMR_PATH` pointing at its install prefix (`$DMR_PATH/lib/libdmr.so`), or `libdmr.so` on the library search path. See [Installation](../../getting-started/installation), or use `module load dmr/3.0.0-alpha` on MN5. `import dmr` works without it; the first call into DMR fails with instructions.

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

The repository ships two complete malleable programs, which are also its tests. Each has a step-by-step tutorial that runs it on a local [MiniDMR](../../user-guide/minidmr) cluster, with nothing but Docker and MiniDMR on your machine:

- [Python Hello World](../../examples/python/hello-world): grows from 1 to 3 nodes and shrinks back to 1, without moving any data. Start here.
- [Python Distributed Dataset](../../examples/python/distributed-dataset): the same, while moving a distributed array between generations over DMR's intercommunicator.

If you work on the bindings themselves, `nix develop` in the `python-dmr` repository provides `just` and `minidmr`, and one command runs both programs on a temporary cluster that is stopped afterwards:

```bash
just e2e                  # build DMR in MiniDMR and run both examples
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

- `dmr.init` and `dmr.auto` take the same three optional callbacks as [`DMR_AUTO`](../../api/core-api) in C: `redist` (send data out, on the old generation), `restart` (receive it, on the new one) and `finalize` (release resources on the last one).
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

- **Policies written in Python are not supported yet.** A policy callback returns a `DMRPolicySuggestion` by value, and `ctypes` cannot create callbacks that return a struct. The built-in policies work (`dmr.get_policy_list()`, `dmr.set_policy(...)`), as does [manual control](../../user-guide/policies/manual-control).

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
