---
title: Reconfiguration Callbacks
description: How to implement expand, shrink, and exit callbacks.
---

Reconfiguration callbacks are functions your application provides to DMR so it can notify you when the process set changes. You pass them as arguments to `DMR_AUTO`.

## The three callbacks

### on_expand

Called on **all surviving ranks** after new processes have been added and `MPI_COMM_WORLD` has been updated to include them.

Use this callback to:
- Broadcast or scatter data to the new ranks
- Recreate derived communicators, MPI windows, or datatypes
- Rebalance your workload across the new process set

```c
void on_expand(void)
{
    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    // Redistribute work based on new size
    rebalance_work(rank, size);
}
```

### on_shrink

Called on **all surviving ranks** after excess processes have exited and `MPI_COMM_WORLD` has been updated.

Use this callback to:
- Gather data from ranks that are leaving before they exit
- Recreate communicators without the removed ranks
- Rebalance your workload across the smaller process set

```c
void on_shrink(void)
{
    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    rebalance_work(rank, size);
}
```

### on_exit

Called on a **rank that is being removed** from the job. After this callback returns, DMR terminates the rank.

Use this callback to:
- Send your partition of data to a surviving rank
- Free any locally allocated memory
- Close open file handles

```c
void on_exit(void)
{
    // Send my data to rank 0 before dying
    MPI_Send(my_data, my_data_size, MPI_DOUBLE, 0, TAG, MPI_COMM_WORLD);
    free(my_data);
}
```

:::caution
Do **not** call `MPI_Finalize` inside `on_exit`. DMR handles rank termination after the callback returns.
:::

## Ordering guarantees

- `on_exit` is invoked on leaving ranks **before** `on_shrink` is invoked on surviving ranks.
- When `on_shrink` runs, the leaving ranks have already exited `MPI_COMM_WORLD`.
- `MPI_COMM_WORLD` is valid and updated in both `on_expand` and `on_shrink`.

## Common pattern: symmetric expand/shrink

Many applications use the same redistribution function for both expand and shrink:

```c
DMR_AUTO(dmr_check(USE_POLICY),
         redistribute(),   // on_expand
         redistribute(),   // on_shrink
         send_data_and_cleanup());
```
