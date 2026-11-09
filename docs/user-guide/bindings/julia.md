---
sidebar_position: 1
sidebar_label: Julia
title: Julia Bindings
---

`DMR.jl` gives Julia programs access to DMR's C API, so an MPI program written in Julia can grow and shrink while it runs. It is a regular Julia package that lives in its own repository, [`julia-dmr`](https://gitlab.bsc.es/accelcom/releases/dmr/tools/julia-dmr), separate from DMR itself.

`libdmr` is never shipped with the package. It is located through `$DMR_PATH` when the module loads, so the same package works against any DMR installation built for the machine it runs on.

This page explains how to install the bindings and how to write and launch a malleable program. For every function and type, see the [Julia API](../../api/julia-api) reference.

## Installing

### 1. DMR

`DMR.jl` needs a built DMR, with `$DMR_PATH` pointing at its install prefix (the library must be at `$DMR_PATH/lib/libdmr.so`). See [Installation](../../getting-started/installation), or use `module load dmr/3.0.0-alpha` on MN5. `using DMR` fails immediately, with instructions, if the library cannot be found.

### 2. Julia

Any recent Julia works; [juliaup](https://github.com/JuliaLang/juliaup) is the simplest way to get one:

```bash
curl -fsSL https://install.julialang.org | sh
```

### 3. The package

From the project your application runs in:

```julia
using Pkg
Pkg.add(url = "https://gitlab.bsc.es/accelcom/releases/dmr/tools/julia-dmr.git")
# or, to work on the bindings themselves, from a local clone:
Pkg.develop(path = "/path/to/julia-dmr")
```

### 4. Point MPI.jl at the system MPI

`MPI.jl` ships its own MPICH by default, and that MPI cannot join the MPI world that DMR's wrapper launches. It has to use the same MPI DMR was built with. Do this once per machine, in the same project your application runs from:

```bash
mpi_prefix=$(dirname "$(dirname "$(command -v mpirun)")")

julia -t 1 --project=. -e 'using Pkg; Pkg.instantiate()'
julia -t 1 --project=. -e "using MPIPreferences; MPIPreferences.use_system_binary(library_names=[\"$mpi_prefix/lib/libmpi\"], mpiexec=\"$mpi_prefix/bin/mpiexec\", abi=\"OpenMPI\")"
```

This writes a `LocalPreferences.toml` next to `Project.toml`. Either command may segfault at teardown after having done its job; what matters is that the file is there afterwards.

## Running an example on MiniDMR

The repository ships two complete malleable programs, which are also its tests. Each has a step-by-step tutorial that runs it on a local [MiniDMR](../../user-guide/minidmr) cluster, with nothing but Docker and MiniDMR and Julia on your machine:

- [Julia Hello World](../../examples/julia/hello-world): grows from 1 to 3 nodes and shrinks back to 1, without moving any data. Start here.
- [Julia Distributed Dataset](../../examples/julia/distributed-dataset): the same, while moving a distributed array between generations over DMR's intercommunicator.

If you work on the bindings themselves, `nix develop` in the `julia-dmr` repository provides `just` and `minidmr`, and one command runs both programs on a temporary cluster that is stopped afterwards:

```bash
just int                  # build DMR in MiniDMR and run both examples
```

## Writing a malleable program

A DMR program in Julia is an ordinary `MPI.jl` program, structured around `dmr_init` and `dmr_auto`:

```julia
using MPI, DMR

MPI.Init()
dmr_init(restart = receive_data)        # in a new generation, runs restart first

while work_left()
    step()
    DMRBindings.dmr_set_nodes_next_expand(Cint(1))
    action = DMRBindings.dmr_check(DMRBindings.SHOULD_EXPAND)
    dmr_auto(action; redist = send_data) # this generation's processes end here on a resize
end

dmr_auto(DMRBindings.dmr_finalize())
MPI.Finalize()
exit(0)
```

- `dmr_init` and `dmr_auto` take the same three optional callbacks as [`DMR_AUTO`](../../api/core-api) in C: `redist` (send data out, on the old generation), `restart` (receive it, on the new one) and `finalize` (release resources on the last one).
- `dmr_auto` terminates the process itself, through `MPI.Finalize()` and `exit()`, whenever DMR reports that the current generation is done. Code after it does not run in a generation being replaced.
- Inside `redist` and `restart`, `dmr_intercomm()` returns the intercommunicator between the old and new generations. It is only available with DMR's default `spawn` mechanism (`DMR_MECHANISM=spawn`).
- The rest of the C API is in the `DMRBindings` submodule under its C names: `DMRBindings.dmr_check`, `DMRBindings.dmr_get_reconfig_count`, `DMRBindings.SHOULD_EXPAND`, and so on. See [Core API](../../api/core-api).
- `exit(0)` at the end is deliberate: Julia's task scheduler can segfault at teardown after `MPI_Finalize`.

Launch it through DMR's wrapper, not a plain `mpirun`:

```bash
dmr mpirun --host <hosts> -x PATH -x DMR_PATH \
    julia -t 1 --project=/path/to/project myprogram.jl
```

- `dmr` is mandatory: DMR relaunches the program for every reconfiguration, and the wrapper keeps its state across generations.
- `-t 1` avoids the same scheduler segfault, and must match the thread count DMR passes to the relaunched `julia`.
- `-x PATH -x DMR_PATH` let the processes DMR spawns for later generations find the same `julia` and the same DMR.

## How the bindings are built

| Layer | Where | How it is produced |
|-------|-------|--------------------|
| `DMRBindings` | `src/dmr_bindings.jl` | Generated from DMR's public headers with [Clang.jl](https://github.com/JuliaInterop/Clang.jl) and committed. Every function in `dmr.h` appears here one to one. |
| `DMR` | `src/lifecycle.jl`, `deps/prologue.jl` | Hand written. Covers what a foreign function interface cannot reach on its own. |

The hand-written pieces, and why they exist:

| Piece | Why it cannot be generated |
|-------|----------------------------|
| `dmr_auto` | `DMR_AUTO` is a preprocessor macro, and no FFI sees macros. This is its Julia transcription, branch by branch. |
| `dmr_init` / `dmr_argv` | DMR relaunches `argv[0]` as the next generation. For Julia that has to be the `julia` interpreter, with its flags, not the script. |
| `dmr_intercomm` | `DMR_INTERCOMM` is an `extern` variable; Clang.jl only emits functions and types. |
| Loading `libdmr` | The library is found at `$DMR_PATH/lib/libdmr.so` and opened in the global symbol scope, which Slurm's plugins need. |

To regenerate after a header change (needs only Julia, no DMR build and no MPI):

```bash
nix develop .#julia
just julia-bindings           # regenerate src/dmr_bindings.jl
just julia-bindings-check     # fail if the committed file is behind dmr/include
just julia-bindings-coverage  # fail if part of the public API has no binding
```
