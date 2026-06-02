---
title: Modes of Operation
description: DMR@Jobs and Slurm4DMR explained.
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

### Setting up Slurm4DMR

1. Ensure all submodules are checked out:
   ```bash
   git submodule update --init --recursive
   ```
2. Navigate to `tools/slurm` and follow the README to install Slurm4DMR.
3. Set the environment variable and point to the installation:
   ```bash
   export SLURM4DMR=1
   export SLURM4DMR_ROOT=/path/to/slurm4dmr
   ```
4. Recompile DMR against the Slurm4DMR installation.

## Connecting to system-default Slurm

The CMake script detects your system's Slurm installation automatically. If detection fails, follow the [manual Slurm connection guide](https://gitlab.bsc.es/accelcom/releases/dmr/dmr/-/wikis/Connecting-to-System-Default-Slurm).
