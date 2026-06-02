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
minidmr start --nodes 4 --project dmr-demo
minidmr enter   # drops you into the controller node
```

You are now inside a container with Open MPI, Slurm, and DMR preinstalled.

## 3. Write your first DMR application

Inside the cluster, create `hello_dmr.c`:

```c
#include <mpi.h>
#include <stdio.h>
#include <unistd.h>
#include "dmr.h"

static void save(void) { /* called on leaving processes */ }
static void load(void) { /* called on restarting processes */ }
static void cleanup(void) { }

int main(int argc, char *argv[])
{
    MPI_Init(&argc, &argv);
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), cleanup());

    for (int i = 0; i < 10; i++) {
        int rank, size;
        MPI_Comm_rank(MPI_COMM_WORLD, &rank);
        MPI_Comm_size(MPI_COMM_WORLD, &size);
        if (rank == 0) printf("iteration %d — %d processes\n", i, size);

        DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());
        sleep(1);
    }

    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
    MPI_Finalize();
    return 0;
}
```

## 4. Compile and run

```bash
mpicc -o hello_dmr hello_dmr.c -ldmr

DMR_DEFAULT_POLICY_MIN=1 \
DMR_DEFAULT_POLICY_MAX=4 \
DMR_PRINT_ANALYTICS=1 \
mpirun -n 1 ./hello_dmr
```

You should see the process count change as DMR expands the job across the cluster nodes.

## 5. Stop the cluster

```bash
exit          # leave the container
minidmr stop
```

## Next steps

- [Installation](installation) — set up DMR on a real cluster
- [Application Structure](../user-guide/app-structure) — understand the full lifecycle
- [Policies Overview](../policies/overview) — choose or implement a scaling policy
