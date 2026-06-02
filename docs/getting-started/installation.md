---
sidebar_position: 2
title: Installation
---

## Prerequisites

DMR requires:

- **Open MPI** built with external OpenPMIX and PRRTE (your system's default is almost certainly incompatible — see note below)
- **Slurm** (system default or Slurm4DMR)
- **CMake** (build only)
- **DLB / TALP** (optional, required for the `ce` policy)

:::caution
No preinstalled version of PRRTE in Open MPI currently meets DMR's requirements. Even if you already have Open MPI installed, follow the dependency instructions below.
:::

## MareNostrum 5 — quick setup

All dependencies are pre-installed. Just load the modules:

```bash
module use /apps/GPP/DMR/dmr-modules
module load openpmix-for-dmr
module load prrte-for-dmr
module load openmpi-for-dmr
module load dlb-for-dmr   # only needed for the CE policy
```

For a manual installation on MN5 see [MareNostrum 5 manual install](installation-mn5).

## Other systems — manual dependency install

Set your prefix variables first:

```bash
export OPENPMIX_PREFIX=/path/to/openpmix
export PRRTE_PREFIX=/path/to/prrte
export OMPI_PREFIX=/path/to/ompi
```

### OpenPMIX

```bash
git clone https://github.com/openpmix/openpmix.git
cd openpmix
git submodule update --init
./autogen.pl
./configure --prefix=$OPENPMIX_PREFIX --disable-debug
make -j$(nproc) install
cd ..

export LD_LIBRARY_PATH=$OPENPMIX_PREFIX/lib:$LD_LIBRARY_PATH
```

### PRRTE

```bash
git clone https://github.com/openpmix/prrte.git
cd prrte
git submodule update --init
./autogen.pl
./configure --prefix=$PRRTE_PREFIX --disable-debug \
  --with-pmix=$OPENPMIX_PREFIX --without-slurm --without-pbs
make -j$(nproc) install
cd ..
```

### Open MPI

:::tip
Including `--with-ucx` is optional but recommended for performance. Ensure you have a UCX installation available.
:::

```bash
git clone https://github.com/open-mpi/ompi.git
cd ompi
git submodule update --init config/oac 3rd-party/pympistandard
./autogen.pl --no-3rdparty openpmix,prrte
./configure --prefix=$OMPI_PREFIX --disable-debug \
  --with-libevent=external --with-hwloc=external \
  --with-pmix=$OPENPMIX_PREFIX --with-prrte=$PRRTE_PREFIX \
  --with-ucx
make -j$(nproc) install
cd ..

export PATH=$OMPI_PREFIX/bin:$PATH
export LD_LIBRARY_PATH=$OMPI_PREFIX/lib:$LD_LIBRARY_PATH
```

Add the `export` lines to your `.bashrc` so they persist between sessions.

On some systems you can satisfy `libevent` and `hwloc` with:

```bash
sudo dnf install flex libevent-devel hwloc-devel
```

### DLB / TALP (optional)

Only needed if you want to use the `ce` (communication efficiency) policy.

```bash
export DLB_PREFIX=/path/to/dlb

wget https://pm.bsc.es/ftp/dlb/releases/dlb-3.5.2.tar.gz
tar -xvf dlb-3.5.2.tar.gz
cd dlb-3.5.2
./configure --prefix=$DLB_PREFIX --with-mpi=$OMPI_PREFIX
make -j$(nproc) install
cd ..

# Add to .bashrc:
LD_PRELOAD="$DLB_PREFIX/lib/libdlb_mpi.so"
export DLB_ARGS="--talp --talp-external-profiler --quiet"
```

## Connecting to Slurm

The CMake script detects your system's Slurm automatically. If it fails:

```bash
# Find the Slurm library
ldd $(which sbatch) | grep libslurm
# e.g. output: libslurmfull.so => /usr/lib64/slurm/libslurmfull.so

export SLURM_LIB=/usr/lib64/slurm
```

If Slurm headers are not on the default search paths:

```bash
# Check your Slurm version
sinfo --version

# Clone the matching Slurm source (no need to install)
git clone --depth 1 --branch <your-version> https://github.com/SchedMD/slurm
export SLURM_INCLUDE=/path/to/slurm/slurm
```

Inside the `slurm/` folder, rename `slurm_version.h.in` to `slurm_version.h` and add before the final `#endif`:

```c
#define SLURM_VERSION_NUMBER SLURM_VERSION_NUM(a,b,c)
```

replacing `a`, `b`, `c` with the numbers from `sinfo --version`.

## Building DMR

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
cmake -B build
cmake --build build
cmake --install build   # optional
```

### CMake options

| Option | Default | Description |
|--------|---------|-------------|
| `DMR_PROCS_PER_NODE` | `1` | Processes spawned per node added in an expand |
| `DMR_USE_TALP` | `0` | Enable DLB/TALP (requires DLB install above) |
| `DMR_CHECKPOINT_RESTART` | `0` | Use checkpoint-restart for reconfigurations |
| `DMR_JOBS_CAN_SHRINK` | `1` | Enable Slurm job shrinking |

```bash
cmake -B build -DDMR_PROCS_PER_NODE=112 -DDMR_USE_TALP=1 -DDLB_ROOT=$DLB_PREFIX
cmake --build build
```

## Linking your application

```c
#include "dmr.h"
#include "dmr_policies.h"
```

```bash
mpicc -o my_app my_app.c -ldmr
```

With CMake:

```cmake
find_package(DMR REQUIRED)
target_link_libraries(my_app PRIVATE DMR::dmr)
```
