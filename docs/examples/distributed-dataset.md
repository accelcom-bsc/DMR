---
sidebar_position: 2
title: Distributed Dataset
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

An example DMR application that keeps a distributed dataset consistent across reconfigurations, driven by the built-in round policy.

Source: the [`distributed-dataset-sleep`](https://gitlab.bsc.es/accelcom/releases/dmr/examples/distributed-dataset-sleep) example repository.

## What it does

1. Initialises MPI and DMR, splitting a dataset of `SIZE` elements evenly (plus a remainder) across ranks.
2. Registers restart, checkpoint, and finalize hooks through `DMR_AUTO`.
3. Registers the built-in round policy and requests reconfiguration with `USE_POLICY` at each iteration.
4. Redistributes the dataset on every reconfiguration and validates that it still holds the expected values.
5. Sleeps between iterations for a duration inversely proportional to the world size, to simulate work that speeds up with more resources.
6. Stops after the configured number of timesteps.

The same source can be compiled and launched for DMR@Jobs or MiniDMR.

## Data redistribution

By default (`make`), `checkpoint`/`restart` use MPI-IO: each rank writes/reads its slice of the dataset to a shared file (`sleepof-checkpoint-file`) using `MPI_File_write_all`/`MPI_File_read_all` on a subarray view.

`make clean && make IN_MEMORY=true` rebuilds the same `sleepOf` binary to instead use `data_send`/`data_receive`, which exchange the dataset directly between old and new processes over `DMR_INTERCOMM` using `MPI_Alltoallv`. This requires DMR to be built with `DMR_CHECKPOINT_RESTART=0` (`dmr_intercomm_available()` is checked before use, and the program aborts with a clear message if it is not) — see [Choose an execution mode](#choose-an-execution-mode) below for which MiniDMR image that means.

## Prerequisites

Clone or enter the example repository, and check out the `v3` branch:

```bash
cd distributed-dataset-sleep
git switch v3
```

The Makefile expects `DMR_PATH` to point to the DMR installation.

## Choose an execution mode

<Tabs groupId="distributed-dataset-mode">
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
make
```

Configure the MN5 batch script (`start_dmratjobs.sh`):

```bash
#SBATCH --time=00:30:00
#SBATCH --exclusive
#SBATCH -N1
#SBATCH --qos=gp_bsccs
#SBATCH -A bsc85

export DMR_PROCS_PER_NODE=2
export DMR_DEFAULT_POLICY_MIN=1
export DMR_DEFAULT_POLICY_MAX=4
```

Run:

```bash
sbatch start_dmratjobs.sh
```

`start_dmratjobs.sh` builds the PRRTE host list from the Slurm allocation and launches:

```bash
$DMR_PATH/scripts/dmr_wrapper prterun --host "$NODELIST_WITH_COUNTS" ./sleepOf 16 4
```

The two trailing arguments are `STEPTIME` (seconds, divided by the current world size at each step) and `TIMESTEPS` (must be even).

  </TabItem>
  <TabItem value="minidmr" label="MiniDMR">

MiniDMR runs DMR in a local Docker-based Slurm cluster. Use it when you want to reproduce the example without an MN5 allocation. `start_minidmr.sh` requests 4 nodes, matching `DMR_DEFAULT_POLICY_MAX=4`: DMR requires launching on every node of the allocation, so the node count and the policy max must match.

Which MiniDMR image you need depends on the build variant:

<Tabs groupId="distributed-dataset-build">
  <TabItem value="mpiio" label="Default (MPI-IO)">

```bash
minidmr start --nodes 4 -i registry.gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr:dmr-3.0.0
```

```bash
cd distributed-dataset-sleep
minidmr enter
make
sbatch --wait start_minidmr.sh
```

  </TabItem>
  <TabItem value="inmemory" label="In-memory">

Requires the `-cr0` image, built with `DMR_CHECKPOINT_RESTART=0`:

```bash
minidmr start --nodes 4 -i registry.gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr:dmr-3.0.0-cr0
```

```bash
cd distributed-dataset-sleep
minidmr enter
make clean && make IN_MEMORY=true
sbatch --wait start_minidmr.sh
```

  </TabItem>
</Tabs>

`start_minidmr.sh` launches `./sleepOf 8 100` (`STEPTIME=8`, `TIMESTEPS=100`) with `DMR_PROCS_PER_NODE=2`. The job writes to `slurm-<jobid>.out`. When you are finished, stop the local cluster:

```bash
exit
minidmr stop
```

  </TabItem>
</Tabs>

The output should show rank 0 reporting each step, the dataset being validated after every reconfiguration, ranks checkpointing before they leave, and restarted ranks rejoining the new allocation. With `DMR_PROCS_PER_NODE=2` and `DMR_DEFAULT_POLICY_MIN=1`/`MAX=4`, a MiniDMR run starting on all 4 allocated nodes (8 processes) cycles through 8 &rarr; 2 &rarr; 4 &rarr; 8 processes as the round policy wraps back to the minimum on overflow. Default (MPI-IO) build:

```text
+ /usr/local/bin/dmr_wrapper mpirun --host mc-slurmd-1:2,mc-slurmd-2:2,mc-slurmd-3:2,mc-slurmd-4:2 ./sleepOf 8 100
Validated the distributed dataset.
[1/8] COMPUTE: sleepOf.c(main,465) - Step 1 doing a sleep of 1.00 seconds (bytes per rank 1024)
Checkpointing using MPI-IO functionality
Restarting using MPI-IO functionality
Validated the distributed dataset.
[1/2] COMPUTE: sleepOf.c(main,465) - Step 2 doing a sleep of 4.00 seconds (bytes per rank 4096)
[1/2] Still waiting for resources to expand
Checkpointing using MPI-IO functionality
Restarting using MPI-IO functionality
Validated the distributed dataset.
[1/4] COMPUTE: sleepOf.c(main,465) - Step 3 doing a sleep of 2.00 seconds (bytes per rank 2048)
[1/4] Still waiting for resources to expand
Checkpointing using MPI-IO functionality
Restarting using MPI-IO functionality
Validated the distributed dataset.
[1/8] COMPUTE: sleepOf.c(main,465) - Step 4 doing a sleep of 1.00 seconds (bytes per rank 1024)
...
```

## Key points

- Reconfiguration bounds and stride for the round policy come from `DMR_DEFAULT_POLICY_MIN`, `DMR_DEFAULT_POLICY_MAX` and `DMR_DEFAULT_POLICY_STRIDE`, read when `dmr_set_policy(dmr_get_policy_round())` registers the policy; they are not set in the source. See [Built-in Policies](../user-guide/policies/dmr-policies).
- `checkpoint`/`restart` **must** account for every element of the dataset; `validate_data` asserts on any mismatch, so a redistribution bug fails fast instead of silently corrupting data.
- Because processes restart from the beginning of `main` on every reconfiguration (even in `IN_MEMORY` mode), progress is tracked via `dmr_get_reconfig_count()` rather than a local loop counter.
- `SIZE` must be divisible by the initial world size; this is only checked on the very first launch (`dmr_get_reconfig_count() == 0`).
