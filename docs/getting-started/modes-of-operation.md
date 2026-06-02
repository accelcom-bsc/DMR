---
sidebar_position: 7
title: Modes of Operation
---

DMR offers two modes of operation, which differ in how they interact with the resource manager.

## DMR@Jobs

DMR@Jobs connects to your **system's default Slurm instance**. Your application runs as a regular Slurm job and DMR requests node additions or removals through the standard Slurm API.

**When to use it:** the default for most clusters. Expansion works by submitting a standard Slurm job with an `expand:` dependency, which is a built-in Slurm mechanism that requires no special administrator configuration. Shrinking (`DMR_JOBS_CAN_SHRINK`) requires Slurm support for removing nodes from a running job, which may need to be enabled by the administrator.

## Slurm4DMR

Slurm4DMR runs a **nested Slurm instance** inside a fixed resource allocation managed by the outer resource manager. Your job owns a fixed set of nodes, and Slurm4DMR reassigns them internally as the application expands or shrinks.

:::note
Slurm4DMR is currently only intended to run on **MareNostrum 5**.
:::

:::info[Not yet documented]
When to use Slurm4DMR vs DMR@Jobs is not yet fully documented. For guidance contact us at [accelcom@bsc.es](mailto:accelcom@bsc.es).
:::

