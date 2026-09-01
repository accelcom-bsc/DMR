---
sidebar_position: 1
title: Hello World
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

A minimal DMR application that shows how DMR reconfigurations work without transferring application data.

Source: the [`hello-world`](https://gitlab.bsc.es/accelcom/releases/dmr/examples/hello-world) example repository.

## What it does

1. Initialises MPI and DMR.
2. Registers restart, checkpoint, and finalize hooks through `DMR_AUTO`.
3. Registers the built-in round policy and requests reconfiguration with `USE_POLICY`.
4. Prints which rank is running, checkpointing, restarting, or exiting.
5. Stops after `MAX_ITERS` reconfigurations.

The same source can be compiled and launched for DMR@Jobs or MiniDMR.

## Prerequisites

Clone or enter the example repository, and check out the `v3` branch:

```bash
cd hello-world
git switch v3
```

The Makefile expects `DMR_PATH` to point to the DMR installation, and compiles with `-DDMR_WITH_TEST_POLICIES` so the built-in round policy (`dmr_get_policy_round`) is declared; see [Policy Headers](../api/policy-headers).

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
make
```

Configure the MN5 batch script (`start_dmratjobs.sh`):

```bash
#SBATCH --time=00:30:00
#SBATCH --exclusive
#SBATCH -N1
#SBATCH --qos=gp_bsccs
#SBATCH -A bsc85

export DMR_PROCS_PER_NODE=1
export DMR_DEFAULT_POLICY_MIN=1
export DMR_DEFAULT_POLICY_MAX=2
```

Run:

```bash
sbatch start_dmratjobs.sh
```

`start_dmratjobs.sh` builds the PRRTE host list from the Slurm allocation and launches:

```bash
$DMR_PATH/bin/dmr_wrapper mpirun --host $NODELIST_WITH_COUNTS ./hello-world
```

This mode drives the reconfiguration through the round policy: it expands until `DMR_DEFAULT_POLICY_MAX` nodes, then shrinks back to `DMR_DEFAULT_POLICY_MIN`, up to `MAX_ITERS` reconfigurations.

  </TabItem>
  <TabItem value="minidmr" label="MiniDMR">

MiniDMR runs DMR in a local Docker-based Slurm cluster. Use it when you want to reproduce the example without an MN5 allocation.

Start a local cluster from the host. `start_minidmr.sh` requests 8 nodes so the example can expand up to `DMR_DEFAULT_POLICY_MAX=8`:

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

The exact node names and rank ordering depend on the allocation. The output should show rank 0 reporting the current reconfiguration count, ranks checkpointing/finalizing before they leave, restarted ranks joining the new allocation, and a final `Goodbye world` line once `MAX_ITERS` reconfigurations are reached. For example:

```text
[1/1] Hello world from mc-slurmd-1. DMR's reconfiguration count is 0. Suggestion to DMR is: USE_POLICY (round policy).
mc-slurmd-1 rank 0 checkpointed. In a real program, the current process would save some data..
mc-slurmd-1 rank 0 restarted. In a real program, the current process would read some data.
[1/2] Hello world from mc-slurmd-1. DMR's reconfiguration count is 1. Suggestion to DMR is: USE_POLICY (round policy).
...
Goodbye world from rank 0 on mc-slurmd-1. DMR's reconfiguration count is 4.
```

## Key points

- Reconfiguration bounds and stride for the round policy come from `DMR_DEFAULT_POLICY_MIN`, `DMR_DEFAULT_POLICY_MAX` and `DMR_DEFAULT_POLICY_STRIDE`, read when `dmr_set_policy(dmr_get_policy_round())` registers the policy; they are not set in the source. See [Built-in Policies](../user-guide/policies/dmr-policies).
- `restart` prints that the rank restarted; a real program would reload or rebuild its data.
- `checkpoint` prints that the rank checkpointed; a real program would save or transfer data before reconfiguration.
- `finalize` prints that the rank is about to exit; a real program would release resources.
- The example uses an infinite wait loop because expansion requests are non-blocking by default.
- During a reconfiguration, ranks call the checkpoint/finalize hooks before exiting, and restarted ranks call the restart hook after DMR relaunches the program.
