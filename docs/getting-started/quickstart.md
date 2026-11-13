---
sidebar_position: 3
title: Hands-on Quickstart
---

The fastest way to try DMR locally is with **MiniDMR**, a CLI that spins up a Docker-based multi-node Slurm cluster in seconds, no HPC access required.

## 1. Install MiniDMR

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="os">
  <TabItem value="linux" label="Linux / macOS">

```bash
curl -fsSL https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.sh | bash
```

  </TabItem>
  <TabItem value="windows" label="Windows (PowerShell)">

```powershell
irm https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.ps1 | iex
```

The script adds the install directory to the user `PATH` automatically.

  </TabItem>
</Tabs>

## 2. Start a cluster

```bash
minidmr start --nodes 4 -i registry.gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr:dmr-3.0.0
```

The `-i` flag selects the image with DMR 3.0.0 preinstalled. Without it, `minidmr start` uses an older image that ships DMR 2.0.0, which does not match this guide.

:::tip
If you used MiniDMR before with a different image, run `minidmr stop` and `docker volume rm etc_slurm` before starting. `minidmr stop` keeps that volume, and a stale Slurm configuration from the other image makes the new cluster fail to start jobs.
:::

## 3. Write your first DMR application

Open your favourite text editor and create `hello_dmr.c` anywhere inside your home directory. The program starts with one process and asks DMR for one more node at a time until it has four:

```c
#include <mpi.h>
#include <stdio.h>
#include <unistd.h>
#include "dmr.h"

#define TARGET_SIZE 4

/* Runs on the processes that are about to exit, before DMR_AUTO calls
   dmr_finalize(). A real application would save or send its data here. */
static void save(void) { printf("  [save] a process hands over its state and exits\n"); }

/* Runs on the freshly launched processes after a reconfiguration. */
static void load(void) { /* a real application would restore its data here */ }

int main(int argc, char *argv[])
{
    MPI_Init(&argc, &argv);

    /* First launch: no action. After a reconfiguration the new processes
       get DMR_RESTART_RECONF here, so load() runs and DMR completes the
       reconfiguration. */
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), (void)NULL);

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    if (rank == 0) printf("Running with %d process(es)\n", size);

    /* dmr_check does not block: it asks for one more node and returns
       DMR_NO_ACTION until the resources are granted, then DMR_RECONF. */
    while (size < TARGET_SIZE) {
        DMR_AUTO(dmr_check(SHOULD_EXPAND), save(), (void)NULL, (void)NULL);
        sleep(1);
    }

    /* Reached once the world has TARGET_SIZE processes. */
    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, (void)NULL);
    MPI_Finalize();
    return 0;
}
```

## 4. Enter the cluster

Navigate to the folder where you saved `hello_dmr.c`, then run:

```bash
minidmr enter
```

MiniDMR mounts your host `$HOME` inside the container and drops you into the same directory where you ran `minidmr enter`, so your file is already there. You are now inside a container with Open MPI, Slurm, and DMR preinstalled.

## 5. Compile and run

```bash
mpicc -o hello_dmr hello_dmr.c -ldmr
```

DMR must run inside a **Slurm job allocation** via the `dmr_wrapper` launcher. The job starts with one node and DMR grows the allocation as the application expands. Create a submit script `submit.sh`:

```bash
#!/bin/bash
#SBATCH --time=00:10:00
#SBATCH --exclusive
#SBATCH -N 1

export DMR_PROCS_PER_NODE=1

NODELIST_WITH_COUNTS=$(scontrol show hostnames "$SLURM_JOB_NODELIST" \
  | awk -v n="$DMR_PROCS_PER_NODE" '{print $1 ":" n}' \
  | paste -sd,)

dmr_wrapper mpirun --host $NODELIST_WITH_COUNTS ./hello_dmr
```

Submit and watch the output:

```bash
sbatch submit.sh
tail -f slurm-*.out
```

You should see `Running with 1 process(es)`, then `Running with 2 process(es)`, and so on until 4. Each reconfiguration relaunches the program at the new size, and the `[save]` lines are printed by the processes that exit to make that possible.

:::note
`dmr_check` does not block. It returns immediately and DMR obtains the new node in the background, which is why the program calls it in a loop until the reconfiguration is ready.
:::

## 6. Stop the cluster

```bash
exit          # leave the container
minidmr stop
```

## Next steps

- More about [MiniDMR](../user-guide/minidmr)
- [Installation](installation): set up DMR on a real cluster
- [Building and Running Your Application](building-and-running): compile and launch your app per mode
- [Application Structure](../user-guide/app-structure): understand the full lifecycle
- [Policies Overview](../user-guide/policies/overview): choose or implement a scaling policy

