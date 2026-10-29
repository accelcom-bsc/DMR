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
module load dmr/3.0.0-alpha       # or dmr/3.0.0-alpha-dlb, for DLB and the CE policy
```

Use that for **production runs** and skip this page; see [Building and Running Your Application](building-and-running). Follow the steps below only if you want to compile DMR from source, e.g. to develop new features.
:::

DMR needs two things: its **dependencies** (a specific build of Open MPI with external OpenPMIX and PRRTE) and **DMR itself**. Once both are in place, compiling and launching your application is covered in [Building and Running Your Application](building-and-running).

:::caution[Unreleased PMIx and PRRTE]
DMR 3.0.0-alpha.1 requires the latest PMIx and PRRTE masters, no older than PMIx `be4c8ef` and PRRTE `c2cc759`. These requirements may change during the alpha.
:::

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
export PKG_CONFIG_PATH=$OPENPMIX_PREFIX/lib/pkgconfig:$PKG_CONFIG_PATH   # DMR finds PMIx through pkg-config
```

**PRRTE**

```bash
git clone https://github.com/openpmix/prrte.git
cd prrte && git submodule update --init
./autogen.pl
./configure --prefix=$PRRTE_PREFIX --disable-debug \
  --with-pmix=$OPENPMIX_PREFIX --with-slurm --without-pbs
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

  </TabItem>
</Tabs>

## 2. Build DMR

With the dependencies in place, the build is the same on any system, and it runs under the [system Slurm or Slurm4DMR](../getting-started/concepts#where-dmr-runs).

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
```

The submodules provide the **Slurm4DMR** sources and the **examples**, both optional. Download them with:
```bash
git submodule update --init --recursive
```

Set two environment variables pointing to the sources and to an install location (edit paths to your liking):

```bash
SOURCES_DMR_PATH=$HOME/dmr
INSTALL_DMR_PATH=$HOME/.local
```

Compile DMR:

```bash
cd $SOURCES_DMR_PATH
cmake -B build -DCMAKE_INSTALL_PREFIX=$INSTALL_DMR_PATH
cmake --build build -j10
cmake --install build
```

Set additional options as needed (see [Configuration](../user-guide/configuration) for the full list of flags):

```bash
cmake -B build \
  -DCMAKE_INSTALL_PREFIX=$INSTALL_DMR_PATH \
  -DDMR_PROCS_PER_NODE=112 \
  -DDMR_USE_TALP=1
```

Remember to keep exported the installation PATH while using DMR with (i.e., .bashrc):
```bash
export DMR_PATH=$INSTALL_DMR_PATH
```

## 3. Build Slurm4DMR (optional)

[Slurm4DMR](https://gitlab.bsc.es/accelcom/releases/dmr/tools/slurm4dmr) is a patched Slurm 25.05 that runs as a nested instance inside an allocation of the host Slurm. Its sources are in the `tools/slurm` submodule. Skip this step to run under the system Slurm only.

On MareNostrum 5, load the pre-built module instead of building it:

```bash
module use /apps/GPP/DMR/dmr-modules
module load slurm4dmr
```

It requires json-c (`json-c-devel`): PRRTE reads `scontrol show job --json` on every allocation change, so without json-c the DVM cannot grow. Install it on a filesystem shared by all nodes of an allocation.

```bash
export SDV3_PATH=$HOME/slurm4dmr-v3   # edit to your liking
cd $SOURCES_DMR_PATH/tools/slurm
mkdir build && cd build
../slurm-src/configure --prefix=$SDV3_PATH --sysconfdir=$SDV3_PATH/etc \
  --with-json=/path/to/json-c
make -j10 && make install
cd .. && bin/install-nested.sh --prefix $SDV3_PATH
```

- Always pass `--with-json`. `configure` ignores `C_INCLUDE_PATH` and `LIBRARY_PATH`, so loading a json-c module is not enough. Without the flag the build succeeds, but every DVM grow fails.
- Keep the json-c library on `LD_LIBRARY_PATH` at run time.
- Slurm bakes the prefix into its binaries. Build at the path the install will keep.
- `install-nested.sh` stages the `slurm4dmr` command, renders a modulefile under `$SDV3_PATH/share/modulefiles`, and records the prefix in `~/.config/slurm4dmr/sdv3.conf`. For a site-wide install, add `--shared --jsonc <json-c prefix>`.

The [Slurm4DMR README](https://gitlab.bsc.es/accelcom/releases/dmr/tools/slurm4dmr/-/blob/v3/README.md) covers the configuration knobs and debugging.

:::info[More information]
Adjust `-j10` to the number of build jobs you want. 

See [Configuration](../user-guide/configuration) for the full list of CMake options.

For help, contact us at [accelcom@bsc.es](mailto:accelcom@bsc.es).
:::
