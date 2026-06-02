---
sidebar_position: 5
title: Quick Start
---

This guide shows the minimal steps to add DMR to an existing MPI application. See [Installation](installation) first if you haven't set up dependencies yet.

## 1. Include the headers

```c
#include <mpi.h>
#include "dmr.h"
#include "dmr_policies.h"
```

## 2. Initialize DMR after MPI

```c
int main(int argc, char **argv)
{
    MPI_Init(&argc, &argv);
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, (void)NULL, (void)NULL);
```

## 3. Set a policy

```c
    dmr_set_policy(dmr_policy_round());  // collective — all ranks must call
```

## 4. Add dmr_check to your main loop

```c
    while (should_keep_running()) {
        DMR_AUTO(dmr_check(USE_POLICY),
                 redistribute_data(),   // called on expand
                 redistribute_data(),   // called on shrink
                 cleanup());            // called on exit
        do_work();
    }
```

## 5. Finalize DMR before MPI

```c
    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
    MPI_Finalize();
    return 0;
}
```

## Complete minimal example

```c
#include <mpi.h>
#include "dmr.h"
#include "dmr_policies.h"

static void redistribute(void) { /* redistribute data across new process set */ }
static void cleanup(void)      { /* free resources before this rank exits */ }

int main(int argc, char **argv)
{
    MPI_Init(&argc, &argv);
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, (void)NULL, (void)NULL);

    dmr_set_policy(dmr_policy_round());

    while (should_keep_running()) {
        DMR_AUTO(dmr_check(USE_POLICY), redistribute(), redistribute(), cleanup());
        do_work();
    }

    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
    MPI_Finalize();
    return 0;
}
```

## Compile and run

```bash
mpicc -o my_app my_app.c -ldmr
DMR_DEFAULT_POLICY_MIN=1 DMR_DEFAULT_POLICY_MAX=8 mpirun -n 2 ./my_app
```
