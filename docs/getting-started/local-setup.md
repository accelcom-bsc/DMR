---
sidebar_position: 2
title: Local Quick Setup
---

The fastest way to try DMR locally is with **MiniDMR**, a CLI that spins up a Docker-based multi-node Slurm cluster in seconds — no HPC access required.

## 1. Install MiniDMR

```bash
curl -fsSL https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.sh | bash
```

## 2. Start a cluster

```bash
minidmr start --nodes 4
minidmr enter   # drops you into the controller node
```

You are now inside a container with Open MPI, Slurm, and DMR preinstalled.

## 3. Write your first DMR application

Inside the cluster, create `hello_dmr.c`:

```c
#include <mpi.h>
#include <stdio.h>
#include "dmr.h"

static void save(void)    { /* save state before leaving processes exit */ }
static void load(void)    { /* restore state after restart */ }
static void cleanup(void) { }

int main(int argc, char *argv[])
{
    MPI_Init(&argc, &argv);

    /* On checkpoint-restart, main() is called again from scratch.
       load() is invoked here when restarting after a reconfiguration. */
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), cleanup());

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    if (rank == 0) printf("Running with %d process(es)\n", size);

    if (size < 4) {
        /* Expand by one node. DMR will checkpoint and restart with more processes. */
        DMR_AUTO(dmr_check(SHOULD_EXPAND), save(), (void)NULL, cleanup());
    }

    /* Reached when size >= 4: all done. */
    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
    MPI_Finalize();
    return 0;
}
```

## 4. Compile and run

```bash
mpicc -o hello_dmr hello_dmr.c -ldmr
```

DMR must run inside a **Slurm job allocation** via the `dmr` wrapper. Create a submit script `submit.sh`:

```bash
#!/bin/bash
#SBATCH --time=00:10:00
#SBATCH --exclusive
#SBATCH -N 4

export SLURM_ROOT="${SLURM_ROOT:-/usr}"
export PATH=$SLURM_ROOT/bin:$PATH
export LD_LIBRARY_PATH=$DMR_PATH/build/lib:$LD_LIBRARY_PATH

export DMR_PROCS_PER_NODE=1

NODELIST_WITH_COUNTS=$(scontrol show hostnames "$SLURM_JOB_NODELIST" \
  | awk -v n="$DMR_PROCS_PER_NODE" '{print $1 ":" n}' \
  | paste -sd,)

$DMR_PATH/bin/dmr_wrapper mpirun --host $NODELIST_WITH_COUNTS ./hello_dmr
```

Submit and watch the output:

```bash
sbatch submit.sh
tail -f slurm-*.out
```

You should see `Running with 1 process(es)`, then `Running with 2 process(es)`, and so on until 4.

## 5. Stop the cluster

```bash
exit          # leave the container
minidmr stop
```

## Next steps

- [Installation](installation) — set up DMR on a real cluster
- [Application Structure](../user-guide/app-structure) — understand the full lifecycle
- [Policies Overview](../policies/overview) — choose or implement a scaling policy
