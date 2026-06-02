---
sidebar_position: 3
title: Reconfiguration Callbacks
---

`DMR_AUTO` accepts three callbacks. Which one is invoked depends on what DMR needs your application to do at each reconfiguration step.

## redist_func — save or redistribute data

Called on ranks that are **about to exit** when a reconfiguration completes. Use it to transfer your data to the surviving processes.

**With checkpoint-restart** (`DMR_CHECKPOINT_RESTART=1`, default): write data to a shared filesystem.

```c
void save_checkpoint(void)
{
    int rank;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    char filename[64];
    snprintf(filename, sizeof(filename), "checkpoint_rank%d.bin", rank);
    FILE *f = fopen(filename, "wb");
    fwrite(my_data, sizeof(double), my_data_size, f);
    fclose(f);
}
```

**With intercommunicator** (`DMR_CHECKPOINT_RESTART=0`): send data to new processes via `DMR_INTERCOMM`.

```c
void send_via_intercomm(void)
{
    if (!dmr_intercomm_available()) return;
    // DMR_INTERCOMM connects old and new processes
    MPI_Send(my_data, my_data_size, MPI_DOUBLE, 0, TAG, DMR_INTERCOMM);
}
```

## restart_func — restore data

Called on processes that have **just been spawned or restarted** after a reconfiguration. Use it to read data saved by `redist_func`.

```c
void load_checkpoint(void)
{
    if (dmr_get_reconfig_count() == 0) return;  // skip on first launch

    int rank;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    char filename[64];
    snprintf(filename, sizeof(filename), "checkpoint_rank%d.bin", rank);
    FILE *f = fopen(filename, "rb");
    fread(my_data, sizeof(double), my_data_size, f);
    fclose(f);
}
```

Pass `restart_func` as the second argument of `DMR_AUTO`:

```c
DMR_AUTO(dmr_init(argc, argv), (void)NULL, load_checkpoint(), cleanup());
```

## finalize_func — clean up resources

Called on any rank that is about to terminate (whether due to reconfiguration or normal exit). Free heap memory, close file handles, etc.

```c
void cleanup(void)
{
    free(my_data);
}
```

## Ordering guarantees

1. `redist_func` is called on **exiting ranks** while the intercommunicator is still valid.
2. `finalize_func` is called on the **same exiting ranks** after `redist_func`.
3. `dmr_finalize()` terminates the rank.
4. Surviving ranks continue their `dmr_check` call and proceed with the updated `MPI_COMM_WORLD`.

## Using dmr_get_reconfig_count()

```c
int count = dmr_get_reconfig_count();
// 0 = first launch, >0 = number of reconfigurations that have occurred
```

This is the standard way to skip checkpoint loading on first launch.
