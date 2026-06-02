---
title: Quick Start
description: Get a DMR application running in minutes.
---

This guide shows the minimal steps to add DMR to an existing MPI application.

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

static void redistribute(void) { /* move your data here */ }
static void cleanup(void)      { /* free resources here */ }

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
mpirun -n 4 ./my_app
```

## Next steps

- Read the [User Guide](/en/user-guide/app-structure/) to understand the application structure in depth.
- Explore the [Policies](/en/policies/overview/) section to choose the right reconfiguration policy.
- Check the [Examples](/en/examples/hello-world/) for complete working programs.
