---
sidebar_position: 4
title: MareNostrum 5 — Manual Build
---

Use this guide only if you need to **compile DMR from source** on MareNostrum 5. For normal use, `module load dmr` is all you need (see [Installation](installation)).

## 1. Load the dependency modules

Instead of building OpenPMIX, PRRTE, and Open MPI from scratch, load the pre-built MN5 modules:

```bash
module use /apps/GPP/DMR/dmr-modules
module load openpmix-for-dmr
module load prrte-for-dmr
module load openmpi-for-dmr
module load dlb-for-dmr   # optional — only for CE policy
```

These set `OPENPMIX_PREFIX`, `PRRTE_PREFIX`, `OMPI_PREFIX`, and `DLB_PREFIX` automatically.

## 2. Build DMR

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
cmake -B build -DCMAKE_INSTALL_PREFIX=/path/to/install
cmake --build build -j112
cmake --install build
```

Set additional options as needed:

```bash
cmake -B build \
  -DCMAKE_INSTALL_PREFIX=/path/to/install \
  -DDMR_PROCS_PER_NODE=112 \
  -DDMR_USE_TALP=1
```

See [Configuration](../user-guide/configuration) for the full list of CMake options.

## Building the dependencies manually (advanced)

If you cannot use the pre-built modules, follow the same steps as [Other systems](installation?system=other) using MN5-specific paths. For Open MPI, add the MN5 UCX path:

```bash
./configure ... --with-ucx=/apps/GPP/UCX/1.16.0/GCC
```

And use `-j112` for all `make` commands.
