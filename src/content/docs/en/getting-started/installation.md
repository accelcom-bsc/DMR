---
title: Installation
description: How to install DMR and its dependencies.
---

import { Tabs, TabItem } from '@astrojs/starlight/components';

## Prerequisites

DMR requires:

- **Open MPI** with PRRTE support (a specific build; your system's default is likely incompatible)
- **Slurm** (system default or Slurm4DMR)
- **CMake** (build only)
- **DLB / TALP** (optional, required for the `ce` policy)

:::caution
Your pre-existing Open MPI installation is likely **not compatible** with DMR because it relies on recently added PRRTE features. Follow the dependency installation instructions below even if you already have Open MPI.
:::

## MareNostrum 5

On MareNostrum 5 all dependencies are pre-installed. Load the required modules:

```bash
module use /apps/GPP/DMR/dmr-modules
module load openpmix-for-dmr
module load prrte-for-dmr
module load openmpi-for-dmr
module load dlb-for-dmr   # optional — needed for the CE policy
```

## Other systems

Install the dependencies manually following the guides on the project wiki:

- [General dependency installation](https://gitlab.bsc.es/accelcom/releases/dmr/dmr/-/wikis/External-Dependency-Installation-General-Instructions)
- [MareNostrum 5 manual installation](https://gitlab.bsc.es/accelcom/releases/dmr/dmr/-/wikis/External-Dependency-Installation-Process-for-MareNostrum5)

## Building DMR

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
cmake -B build
cmake --build build
cmake --install build   # optional; installs headers and libdmr
```

### CMake options

| Option | Default | Description |
|--------|---------|-------------|
| `DMR_PROCS_PER_NODE` | `1` | Processes spawned per added node |
| `DMR_USE_TALP` | `0` | Enable DLB/TALP integration |
| `DMR_CHECKPOINT_RESTART` | `0` | Use checkpoint-restart for reconfigurations |
| `DMR_JOBS_CAN_SHRINK` | `1` | Enable Slurm job shrinking |

Example with custom options:

```bash
cmake -B build -DDMR_PROCS_PER_NODE=112 -DDMR_USE_TALP=1 -DDLB_ROOT=$DLB_ROOT
cmake --build build
```

## Linking your application

Add `-ldmr` to your link flags and include `dmr.h`:

```c
#include "dmr.h"
#include "dmr_policies.h"  // if you use policies
```

With CMake:

```cmake
find_package(DMR REQUIRED)
target_link_libraries(my_app PRIVATE DMR::dmr)
```
