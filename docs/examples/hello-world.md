---
sidebar_position: 1
title: Hello World
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

A minimal DMR application that shows how DMR reconfigurations work without transferring application data.

Source: the `hello-world` example repository.

## What it does

1. Initialises MPI and DMR.
2. Registers restart, checkpoint, and finalize hooks through `DMR_AUTO`.
3. Uses a DMR policy to request reconfiguration.
4. Prints which rank is running, checkpointing, restarting, or exiting.
5. Stops after the configured number of reconfigurations.

The same source can be compiled and launched for DMR@Jobs, Slurm4DMR, or MiniDMR.

## Prerequisites

Clone or enter the example repository:

```bash
cd hello-world
```

The Makefile expects `DMR_PATH` to point to the DMR installation. The Slurm4DMR target also expects `DLB_HOME`.

## Choose an execution mode

<Tabs groupId="hello-world-mode">
  <TabItem value="dmrjobs" label="DMR@Jobs">

DMR@Jobs uses the system Slurm instance. On MN5, use the pre-built DMR module:

```bash
module load dmr
```

Check that the module exported `DMR_PATH`:

```bash
echo "$DMR_PATH"
```

Compile:

```bash
make clean
make helloJobs
```

Configure the MN5 batch script (`start_dmratjobs.sh`):

```bash
#SBATCH --time=00:30:00
#SBATCH --exclusive
#SBATCH -N1
#SBATCH --qos=gp_bsccs
#SBATCH -A bsc85

export DMR_NODES_IN_EXPAND=1
export DMR_PROCS_PER_NODE=2
```

Run:

```bash
sbatch start_dmratjobs.sh
```

`start_dmratjobs.sh` builds the PRRTE host list from the Slurm allocation and launches:

```bash
$DMR_PATH/scripts/dmr_wrapper prterun --host "$NODELIST_WITH_COUNTS" ./hello-world
```

This mode drives the reconfiguration manually. It expands to a new Slurm job, shrinks back down to a single job, and then terminates.

  </TabItem>
  <TabItem value="slurm4dmr" label="Slurm4DMR">

Slurm4DMR runs a nested Slurm instance inside an outer MN5 allocation. Unlike DMR@Jobs, this requires a manual Slurm4DMR installation first; see [Installation](../getting-started/installation#2-build-dmr).

After installing DMR with Slurm4DMR support and the custom Slurm, load the MN5 dependency modules:

```bash
module use /apps/GPP/DMR/dmr-modules
module load dlb-for-dmr
module load openpmix-for-dmr
module load prrte-for-dmr
module load openmpi-for-dmr
```

Set the paths used by the nested Slurm launcher:

```bash
export DMR_PATH=/path/to/dmr
export SLURM_ROOT=/path/to/slurm4dmr
export SLURM_CONFDIR_BASE=/path/to/slurm4dmr-confdir
export DLB_HOME="${DLB_HOME:-$DLB_PREFIX}"
```

Compile:

```bash
make clean
make helloSlurm
```

Configure the outer MN5 batch script (`start_slurm4dmr.sh`):

```bash
#SBATCH --time=00:15:00
#SBATCH --exclusive
#SBATCH -N9
#SBATCH -o slurm4dmr.log
#SBATCH --qos=gp_debug
#SBATCH -A bsc85
```

Configure the inner script submitted to the nested Slurm instance:

```bash
#SBATCH --time=00:30:00
#SBATCH --exclusive
#SBATCH -N4

export DMR_PROCS_PER_NODE=1
```

Run:

```bash
sbatch start_slurm4dmr.sh
```

`start_slurm4dmr.sh` deploys the nested Slurm infrastructure and automatically submits `submit_custom_slurm.sh`. The inner job launches:

```bash
$DMR_PATH/scripts/dmr_wrapper mpirun --host "$NODELIST_WITH_COUNTS" ./hello-world
```

This mode uses a round-trip scaling policy and reconfigures up to `MAX_ITERS_SLURM4DMR` times.

  </TabItem>
  <TabItem value="minidmr" label="MiniDMR">

MiniDMR runs the Slurm4DMR version of DMR in a local Docker-based Slurm cluster. Use it when you want to reproduce the Slurm4DMR workflow without using an MN5 allocation.

:::note
MiniDMR is not an MN5 execution mode. It is a local Slurm4DMR test environment.
:::

Start a local cluster from the host. `start_minidmr.sh` requests 4 nodes and the example can expand to 8, so start MiniDMR with 8 workers:

```bash
minidmr start --nodes 8 -i registry.gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr:dmr-3.0.0
```

Enter the MiniDMR controller from the example directory:

```bash
cd hello-world
minidmr enter
```

Compile:

```bash
make
```

Run:

```bash
sbatch --wait start_minidmr.sh
```

The job writes to `slurm-<jobid>.out`.

When you are finished, stop the local cluster:

```bash
exit
minidmr stop
```

  </TabItem>
</Tabs>

The exact node names and rank ordering depend on the allocation. The output should show rank 0 reporting the current reconfiguration count, ranks checkpointing/finalizing before they leave, restarted ranks joining the new allocation, and final `Goodbye world` lines when the configured reconfiguration count is reached. For example:

```text
[1/4] Hello world from mc-slurmd-1. DMR's reconfiguration count is 0.
[1/8] Hello world from mc-slurmd-1. DMR's reconfiguration count is 1.
...
Goodbye world from rank 0 on mc-slurmd-1. DMR's reconfiguration count is 10.
```

## Key points

- `restart` prints that the rank restarted; a real program would reload or rebuild its data.
- `checkpoint` prints that the rank checkpointed; a real program would save or transfer data before reconfiguration.
- `finalize` prints that the rank is about to exit; a real program would release resources.
- DMR@Jobs uses an infinite wait loop because expansion requests are non-blocking by default.
- During a reconfiguration, ranks call the checkpoint/finalize hooks before exiting, and restarted ranks call the restart hook after DMR relaunches the program.
