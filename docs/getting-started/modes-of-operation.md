---
sidebar_position: 6
title: Modes of Operation
---

DMR offers two modes of operation, which differ in how they interact with the resource manager.

## DMR@Jobs

DMR@Jobs connects to your **system's default Slurm instance**. Your application runs as a regular Slurm job and DMR requests node additions or removals through the standard Slurm API.

**When to use it:** general use on any cluster where Slurm is installed and the administrator allows job resizing.

## Slurm4DMR

Slurm4DMR runs a **nested Slurm instance** inside a fixed resource allocation managed by the outer resource manager. Your job owns a fixed set of nodes, and Slurm4DMR reassigns them internally as the application expands or shrinks.

:::note
Slurm4DMR is currently only intended to run on **MareNostrum 5**.
:::

**When to use it:** when your cluster does not support job resizing, or when you need more control over resource allocation.

### Installing Slurm4DMR

On MareNostrum 5 you can load the pre-installed OpenSSL module:

```bash
module use /apps/GPP/DMR/dmr-modules
module load openssl-for-slurm4dmr
```

Then build and install:

```bash
export SLURM_ROOT="$PWD/slurm-install"   # edit to your liking

cd custom-slurm

# If NOT using the MareNostrum 5 module, set:
# export OPENSSL_PATH=/path/to/openssl

./configure --prefix=$SLURM_ROOT \
  --sysconfdir=$SLURM_ROOT/slurm-confdir \
  --without-pmix \
  --with-ssl=$OPENSSL_PATH

make CFLAGS='-fcommon' CXXFLAGS='-fcommon' -j$(nproc)
make install
```

### Building DMR against Slurm4DMR

Make sure all submodules are checked out:

```bash
git submodule update --init --recursive
```

Then point DMR to your Slurm4DMR installation:

```bash
export SLURM4DMR=1
export SLURM4DMR_ROOT=$SLURM_ROOT

cmake -B build
cmake --build build
```

### OpenSSL (manual install)

If you cannot use the pre-installed module, build OpenSSL 1.0.2j from source:

```bash
git clone --depth 1 --branch OpenSSL_1_0_2j https://github.com/openssl/openssl
```

In `Makefile`, add `-fPIC` to the `CFLAG` line. Then:

```bash
./config --prefix=/path/to/openssl
make -j$(nproc) install
export LD_LIBRARY_PATH=/path/to/openssl/lib:$LD_LIBRARY_PATH
```
