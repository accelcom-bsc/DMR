---
sidebar_position: 5
title: Building and Running
---

Once DMR is available on your system, you compile your application against it and launch it through the DMR wrapper.

## Prerequisite: DMR installed

- **MareNostrum 5:** `module load dmr/3.0.0-alpha` provides the library, headers, and all dependencies.
- **Other systems:** build DMR from source, see [Installation](installation).

Either way you end up with DMR's `include` and `lib` directories available (referred to below as `$DMR_PATH`).

## Compiling your application

Include the header and link against `libdmr`:

```c
#include "dmr.h"
```

```bash
mpicc -o my_app my_app.c -I$DMR_PATH/include -L$DMR_PATH/lib -ldmr
```

If the DMR module (or your environment) already exposes the include and library paths, `-ldmr` alone is enough:

```bash
mpicc -o my_app my_app.c -ldmr
```

With CMake:

```cmake
find_package(DMR REQUIRED)
target_link_libraries(my_app PRIVATE DMR::dmr)
```

## Running your application

DMR must run inside a **Slurm job allocation**, launched through the `dmr` wrapper.

### The `dmr` wrapper

`dmr` takes the launcher (`prterun`, `mpirun` or `mpiexec`) and its arguments. It starts a persistent PRRTE DVM, runs the application into it, and terminates the DVM on exit. It is also installed as `dmr_wrapper`.

- The application's processes must cover every node of the allocation. Otherwise `dmr_init` fails and names the unused nodes.
- `--map-by` accepts only `slot`, optionally with `:OVERSUBSCRIBE`. The wrapper rejects other policies.
- Reconfigurations do not oversubscribe nodes. To allow it, launch with `--map-by slot:OVERSUBSCRIBE` and set `DMR_CAP_PROCS_TO_SLOTS=0`.
- Any host named with `--host` must be part of the allocation.

### Configuring DMR at launch

DMR reads environment variables at launch, so you can tune its behaviour from the submit script without recompiling. The most common ones:

```bash
export DMR_DEBUG_LEVEL=1       # 0 = off, 1 = rank 0 only, 2 = all ranks
export DMR_PRINT_ANALYTICS=1   # print an analytics line at each reconfiguration
export DMR_DEFAULT_POLICY_MIN=2
export DMR_DEFAULT_POLICY_MAX=4
```

See [Configuration](../user-guide/configuration#runtime-environment-variables) for the full list.

### Submitting a job

Submit a normal batch job that invokes the wrapper. As the application reconfigures, DMR requests and releases nodes through PRRTE, which passes the requests on to the system's Slurm.

```bash
#!/bin/bash
#SBATCH --time=00:10:00
#SBATCH --exclusive
#SBATCH -N 1

export DMR_PROCS_PER_NODE=1

NODELIST_WITH_COUNTS=$(scontrol show hostnames "$SLURM_JOB_NODELIST" \
  | awk -v n="$DMR_PROCS_PER_NODE" '{print $1 ":" n}' \
  | paste -sd,)

dmr mpirun --host $NODELIST_WITH_COUNTS ./my_app
```

```bash
sbatch submit.sh
```

### Slurm4DMR

Slurm4DMR runs a **nested Slurm instance** inside a fixed allocation, which reassigns nodes internally as the application reconfigures. It needs a launch script that deploys the nested Slurm and submits your job to it (the wrapper invocation is the same `dmr mpirun` pattern, but it runs against the inner Slurm).

:::note
Slurm4DMR is currently only intended to run on **MareNostrum 5**. The full nested-deployment setup is not yet documented here; for help contact us at [accelcom@bsc.es](mailto:accelcom@bsc.es).
:::

### Locally with MiniDMR

To try DMR on your own machine without HPC access, use MiniDMR, which spins up a Docker-based Slurm cluster. See [Quick Setup](quickstart).
