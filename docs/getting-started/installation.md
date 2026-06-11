---
sidebar_position: 4
title: Installation
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

This page covers **building DMR from source**.

:::tip[On MareNostrum 5 you do not need this]
A pre-built module already provides the library, headers, and all dependencies:

```bash
module load dmr
```

Use that for normal runs and skip this page; see [Building and Running Your Application](building-and-running). Follow the steps below only if you want to compile DMR from source (e.g. to modify it).
:::

DMR needs two things: its **dependencies** (a specific build of Open MPI with external OpenPMIX and PRRTE) and **DMR itself**. Once both are in place, compiling and launching your application is covered in [Building and Running Your Application](building-and-running).

## 1. Get the dependencies

<Tabs groupId="system">
  <TabItem value="mn5" label="MareNostrum 5">

Instead of building OpenPMIX, PRRTE, and Open MPI from scratch, load the pre-built MN5 modules:

```bash
module load cmake
module use /apps/GPP/DMR/dmr-modules
module load openpmix-for-dmr
module load prrte-for-dmr
module load openmpi-for-dmr
module load dlb-for-dmr   # optional, only for the CE policy
```

These set `OPENPMIX_PREFIX`, `PRRTE_PREFIX`, `OMPI_PREFIX`, and `DLB_PREFIX` automatically.

:::note
If you cannot use the pre-built modules, follow the **Other systems** tab using MN5-specific paths, adding the MN5 UCX path to the Open MPI `./configure` (`--with-ucx=/apps/GPP/UCX/1.16.0/GCC`).
:::

  </TabItem>
  <TabItem value="other" label="Other systems">

DMR requires a specific build of Open MPI with external OpenPMIX and PRRTE. Your system's default Open MPI is almost certainly incompatible.

:::caution
Even if you already have Open MPI installed, follow these steps; the required PRRTE features are not present in standard distributions.
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

**DLB / TALP** (optional, only for the CE policy)

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

**Connect to Slurm.** CMake detects your Slurm automatically. If it fails:

```bash
ldd $(which sbatch) | grep libslurm   # find the library path
export SLURM_LIB=/usr/lib64/slurm     # set it
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

  </TabItem>
</Tabs>

## 2. Build DMR

With the dependencies in place, the build is the same on any system, you just need to chose which flavour you want: controlled (Slurm4DMR) or production (DMR@jobs) environment ([see](../getting-started/concepts)).

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
```

Download also examples and tools with (mandatory for Slurm4DMR but recommended for the *examples*):
```bash
git submodule update --init --recursive
```

For instance, assuming that (edit paths to your liking):

```bash
SOURCES_DMR_PATH=$HOME/dmr
INSTALL_DMR_PATH=$HOME/dmr-install
```

<Tabs groupId="mode">
<TabItem value="slurm4dmr" label="Slurm4DMR">

First of all, you need the custom Slurm that will run nested to the main Slurm job:

```bash
cd $SOURCES_DMR_PATH/tools/slurm4dmr
export SLURM4DMR_ROOT="$PWD/slurm-install" # Edit to your liking
cd custom-slurm
./configure --prefix=$SLURM4DMR_ROOT --sysconfdir=$SLURM_ROOT/slurm-confdir --without-pmix --with-ssl=$OPENSSL_PATH
make CFLAGS='-fcommon' CXXFLAGS='-fcommon' -j10
make install
```

Then, DMR:

```bash
cd $SOURCES_DMR_PATH
cmake -B build \
  -DCMAKE_INSTALL_PREFIX=$INSTALL_DMR_PATH \
  -DSLURM4DMR=1 \
cmake --build build -j10
cmake --install build
```

Export SLURM4DMR_ROOT with the custom Slurm installation path and when using Slurm4DMR keep it in your environment (i.e., .bashrc).

</TabItem>
<TabItem value="dmrjobs" label="DMR@jobs">

Compile DMR:

```bash
cd $SOURCES_DMR_PATH
cmake -B build -DCMAKE_INSTALL_PREFIX=$INSTALL_DMR_PATH 
cmake --build build -j10
cmake --install build
```

Set additional options as needed:

```bash
cmake -B build \
  -DCMAKE_INSTALL_PREFIX=$INSTALL_DMR_PATH \
  -DDMR_PROCS_PER_NODE=112 \
  -DDMR_USE_TALP=1
```

</TabItem>
</Tabs>

Remember to keep exported the installation PATH while using DMR with (i.e., .bashrc):
```bash
export DMR_PATH=$INSTALL_DMR_PATH
```

:::info[More information]
Adjust `-j10` to the number of build jobs you want. 

See [Configuration](../user-guide/configuration) for the full list of CMake options.

For help, contact us at [accelcom@bsc.es](mailto:accelcom@bsc.es).
:::
