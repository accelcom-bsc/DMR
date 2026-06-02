---
sidebar_position: 3
title: Installation
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="system">
  <TabItem value="mn5" label="MareNostrum 5">

## MareNostrum 5

The easiest path: load the pre-built DMR module and you're done — no compilation needed.

```bash
module use /apps/GPP/DMR/dmr-modules
module load dmr
```

That single module provides the library, headers, and all dependencies (Open MPI, PRRTE, OpenPMIX). Use this for production runs.

If you need to **compile DMR yourself** on MN5 (e.g. to modify the source), see [MareNostrum 5 — Manual Build](installation-mn5).

  </TabItem>
  <TabItem value="other" label="Other systems">

## Other systems

### 1. Build the dependencies

DMR requires a specific build of Open MPI with external OpenPMIX and PRRTE. Your system's default Open MPI is almost certainly incompatible.

:::caution
Even if you already have Open MPI installed, follow these steps — the required PRRTE features are not present in standard distributions.
:::

Set your install prefixes:

```bash
export OPENPMIX_PREFIX=/path/to/openpmix
export PRRTE_PREFIX=/path/to/prrte
export OMPI_PREFIX=/path/to/ompi
```

**OpenPMIX**

```bash
git clone https://github.com/openpmix/openpmix.git
cd openpmix && git submodule update --init
./autogen.pl
./configure --prefix=$OPENPMIX_PREFIX --disable-debug
make -j$(nproc) install && cd ..
export LD_LIBRARY_PATH=$OPENPMIX_PREFIX/lib:$LD_LIBRARY_PATH
```

**PRRTE**

```bash
git clone https://github.com/openpmix/prrte.git
cd prrte && git submodule update --init
./autogen.pl
./configure --prefix=$PRRTE_PREFIX --disable-debug \
  --with-pmix=$OPENPMIX_PREFIX --without-slurm --without-pbs
make -j$(nproc) install && cd ..
```

**Open MPI**

```bash
git clone https://github.com/open-mpi/ompi.git
cd ompi && git submodule update --init config/oac 3rd-party/pympistandard
./autogen.pl --no-3rdparty openpmix,prrte
./configure --prefix=$OMPI_PREFIX --disable-debug \
  --with-libevent=external --with-hwloc=external \
  --with-pmix=$OPENPMIX_PREFIX --with-prrte=$PRRTE_PREFIX \
  --with-ucx        # optional but recommended
make -j$(nproc) install && cd ..
export PATH=$OMPI_PREFIX/bin:$PATH
export LD_LIBRARY_PATH=$OMPI_PREFIX/lib:$LD_LIBRARY_PATH
```

Add the `export` lines to your `.bashrc`. On some systems:

```bash
sudo dnf install flex libevent-devel hwloc-devel
```

**DLB / TALP** (optional — only for the CE policy)

```bash
export DLB_PREFIX=/path/to/dlb
wget https://pm.bsc.es/ftp/dlb/releases/dlb-3.5.2.tar.gz
tar -xvf dlb-3.5.2.tar.gz && cd dlb-3.5.2
./configure --prefix=$DLB_PREFIX --with-mpi=$OMPI_PREFIX
make -j$(nproc) install && cd ..
# Add to .bashrc:
LD_PRELOAD="$DLB_PREFIX/lib/libdlb_mpi.so"
export DLB_ARGS="--talp --talp-external-profiler --quiet"
```

### 2. Connect to Slurm

CMake detects your Slurm automatically. If it fails:

```bash
ldd $(which sbatch) | grep libslurm   # find the library path
export SLURM_LIB=/usr/lib64/slurm    # set it
```

If Slurm headers are missing, clone the matching Slurm source:

```bash
sinfo --version   # find your version
git clone --depth 1 --branch <version> https://github.com/SchedMD/slurm
export SLURM_INCLUDE=/path/to/slurm/slurm
```

Rename `slurm_version.h.in` → `slurm_version.h` and add before the final `#endif`:

```c
#define SLURM_VERSION_NUMBER SLURM_VERSION_NUM(a,b,c)
```

### 3. Build DMR

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
cmake -B build -DCMAKE_INSTALL_PREFIX=/path/to/install
cmake --build build
cmake --install build
```

See [Configuration](../user-guide/configuration) for the full list of CMake options.

  </TabItem>
</Tabs>

## Linking your application

```c
#include "dmr.h"
```

```bash
mpicc -o my_app my_app.c -ldmr
```

With CMake:

```cmake
find_package(DMR REQUIRED)
target_link_libraries(my_app PRIVATE DMR::dmr)
```
