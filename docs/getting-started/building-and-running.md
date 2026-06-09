---
sidebar_position: 5
title: Building and Running
---

Once DMR is available on your system, you compile your application against it and launch it through the DMR wrapper. **How you compile and launch depends on the [mode of operation](modes-of-operation)** you target.

## Prerequisite: DMR installed

- **MareNostrum 5:** `module load dmr` provides the library, headers, and all dependencies.
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

### The mode is fixed when DMR is built

The mode is **baked into the DMR library at build time**, not chosen when you compile your application. A given DMR build targets one backend:

| Mode | How DMR was built |
| --- | --- |
| DMR@Jobs (default) | standard build |
| Slurm4DMR | built with the `SLURM4DMR` CMake option |

Your application links against `libdmr` the same way in both cases, and runs in whichever mode the DMR it links against was built for. So there is no app-side flag: to use Slurm4DMR, link against (or `module load`) a DMR that was compiled with `SLURM4DMR`. See [Installation](installation) and the [`SLURM4DMR` CMake option](../user-guide/configuration#cmake-options).

## Running your application

DMR must run inside a **Slurm job allocation**, launched through the `dmr` wrapper (which wraps `mpirun`). The way you do this differs by mode.

### Configuring DMR at launch

DMR reads environment variables at launch, so you can tune its behaviour from the submit script without recompiling. The most common ones:

```bash
export DMR_DEBUG_LEVEL=1       # 0 = off, 1 = rank 0 only, 2 = all ranks
export DMR_PRINT_ANALYTICS=1   # print an analytics line at each reconfiguration
export DMR_DEFAULT_POLICY_MIN=2
export DMR_DEFAULT_POLICY_MAX=4
```

See [Configuration](../user-guide/configuration#runtime-environment-variables) for the full list.

### DMR@Jobs

Submit a normal batch job that invokes the wrapper. DMR requests node additions or removals from the system's Slurm as the application reconfigures.

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

Slurm4DMR runs a **nested Slurm instance** inside a fixed allocation, which reassigns nodes internally as the application reconfigures. Requires a DMR built with `SLURM4DMR`, then a launch script that deploys the nested Slurm and submits your job to it (the wrapper invocation is the same `dmr mpirun` pattern, but it runs against the inner Slurm).

:::note
Slurm4DMR is currently only intended to run on **MareNostrum 5**. The full nested-deployment setup is not yet documented here; for help contact us at [accelcom@bsc.es](mailto:accelcom@bsc.es).
:::

### Locally with MiniDMR

To try DMR on your own machine without HPC access, use MiniDMR, which spins up a Docker-based Slurm cluster. See [Local Quick Setup](local-setup).
