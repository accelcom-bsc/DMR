---
sidebar_position: 5
title: Applying DMR to Your Application
---

This guide helps you evaluate whether DMR fits your application and walks through the key steps to integrate it.

## Is DMR right for your application?

DMR works well when:

- Your application is **MPI-based and iterative**: it has a main loop where all ranks synchronize periodically.
- Your workload has **phases with different resource needs**: e.g. a compute-heavy phase that benefits from more nodes and a communication-heavy phase that does not.
- You can tolerate a **brief interruption** at reconfiguration points (the process set changes between iterations).

It is less suitable when:

- Your application has no clear synchronization points (tightly coupled, no loop structure).
- The cost of saving and restoring state is too high relative to the time saved by scaling.

**If your application already implements checkpoint-restart**, DMR is trivially easy to adopt: hook your existing save/load logic into `redist_func` and `restart_func` and add `dmr_check` at the checkpoint point.

## Finding good reconfiguration points

A reconfiguration point is where DMR will pause, change the process set, and resume. The best candidates are **natural synchronization points** that already exist in your code:

- The boundary between iterations in your main loop.
- Just before or after a collective operation (`MPI_Barrier`, `MPI_Allreduce`, `MPI_Bcast`, etc.).
- Between distinct phases of your application (e.g. after a solve step, before a post-processing step).

Avoid points where:

- There are pending non-blocking MPI operations (`MPI_Isend`/`MPI_Irecv` not yet completed).
- You hold open MPI windows (`MPI_Win`) or active epochs.
- You are inside a communicator that is not `MPI_COMM_WORLD`.

A single well-chosen point per iteration is enough for most applications.

## Setting up data redistribution

This is the main integration work. You need to answer: *what state must survive a reconfiguration?*

Typical state that needs saving:

- The iteration counter or simulation time step.
- Distributed arrays or vectors (each rank saves its local partition).
- Any derived quantities that are expensive to recompute.

**If you already have checkpoint-restart**, map it directly:

```c
// redist_func: called before this rank exits
void save(void) {
    write_checkpoint("checkpoint.bin", my_data, my_iteration);
}

// restart_func: called when restarting after a reconfiguration
void load(void) {
    read_checkpoint("checkpoint.bin", &my_data, &my_iteration);
}
```

Then add DMR to your main loop:

```c
DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), (void)NULL);

while (my_iteration < max_iterations) {
    DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, (void)NULL);
    do_work();
    my_iteration++;
}
```

**If you do not have checkpoint-restart**, you need to implement save and load from scratch. The key question is whether saving your state to disk at each potential reconfiguration point is affordable. If it is, proceed. If the state is too large or the I/O cost is too high, consider the [intercommunicator mode](../user-guide/data-redistribution#intercommunicator) instead.

For a full explanation of the lifecycle and the `DMR_AUTO` macro see [Application Structure](../user-guide/app-structure).

## Trade-offs

**Pros**

- Scale up or down during a run without resubmitting the job, keeping your place in the queue.
- Release idle resources back to the cluster between phases, improving overall cluster utilization.
- Adapt to workload phases that have different resource requirements at runtime.
- If your application already implements checkpoint-restart, integration is minimal.

**Cons**

- Reconfigurations add overhead because the application must wait for Slurm to grant the requested resources; the wait depends on cluster queue pressure.
- You must identify safe reconfiguration points in your main loop.
- State save and restore logic must be implemented and tested if not already present.
