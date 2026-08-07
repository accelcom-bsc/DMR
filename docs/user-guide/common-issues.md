---
sidebar_position: 99
title: Common Issues
---

## Overlapping expands cause MPI launch failure

**Symptom:** consecutive expansions fail with an MPI spawn or PRRTE launch error.

**Cause:** if `dmr_check(SHOULD_EXPAND)` is called again before the previous expansion has fully settled, the two MPI spawn operations can interfere with each other.

**Fix:** add a short `sleep` before each `dmr_check` call to let the previous expand complete:

```c
sleep(2);
DMR_AUTO(dmr_check(SHOULD_EXPAND), save(), (void)NULL, cleanup());
```

---

## Did you launch with the DMR wrapper?

**Symptom:**
```
DMR Error: Could not detect DMR state. Did you launch with the DMR wrapper?
```

**Cause:** the application was launched with `mpirun` directly instead of through `dmr`.

**Fix:** always launch with the wrapper:
```bash
dmr mpirun --host $NODELIST_WITH_COUNTS ./my_app
```

---

## Issue fetching Slurm job ID info from environment

**Symptom:**
```
DMR Error: Issue fetching Slurm job ID info from environment.
```

**Cause:** the application was run outside of a Slurm job allocation (e.g. directly from the shell). DMR requires `SLURM_JOB_ID` to be set, which only happens inside a job.

**Fix:** submit via `sbatch` or run inside `salloc`.

---

## dmr_wrapper can't find the executable

**Symptom:**
```
Error: dmr_wrapper was not able to find an executable in the provided command
```

**Cause:** `dmr_wrapper` looks for the executable by scanning the command's arguments for the first one that is either a file that exists and is executable relative to the job's current working directory, or a name resolvable via `PATH`. A relative path (e.g. `./build/my_app`) only works if that working directory is what you think it is -- Slurm jobs default to the submission directory (`$SLURM_SUBMIT_DIR`), not necessarily wherever the batch script file itself lives, especially with nested Slurm setups (Slurm4DMR) or scripts that live in a subdirectory of the project.

**Fix:** use an absolute path to the executable instead of a relative one, e.g. anchored on `$SLURM_SUBMIT_DIR`.

---

## App starts already at full size, no reconfigs happen

**Symptom:** the app runs and finishes immediately, `dmr_check` reports the target size already reached with `0 reconfig(s)` -- it never grows.

**Cause:** `mpirun --host host1:1,host2:1,...` without `-np` uses every slot the hostlist offers, so the app starts at that full size right away instead of at 1 process. `dmr_wrapper` expects `-np`/`--np` to be present -- it explicitly strips it back out when rebuilding the launch command for each reconfig.

**Fix:** pass `-np 1` (or whatever the intended starting size is) explicitly.

---

## Expand hangs forever waiting for Slurm resources

**Symptom:** `dmr_check` reports `SHOULD EXPAND`, then the app hangs indefinitely, repeatedly logging `About to read expander job (ID N) state...` / `Read expander job state: 0...`.

**Cause:** DMR grows by submitting its own separate "expander jobs" to Slurm to claim more nodes. If the app's own job already holds every node available in its partition/allocation (e.g. submitted with `--exclusive` over the whole cluster), there's nothing left for the expander job to land on, so it stays pending forever. `DMR_NODES_IN_EXPAND` (default `1`) matters too: if it's set higher than the number of nodes actually free, the expander job can never be satisfied either.

**Fix:** leave free nodes in the allocation/partition for expander jobs to use -- don't let the app's own job request all of them -- and make sure `DMR_NODES_IN_EXPAND` doesn't exceed how many nodes are actually free to grow into.

---

## cgroup.conf parse errors in slurm output

**Symptom:**
```
slurmstepd: error: Parse error in file /etc/slurm/cgroup.conf line 1: "CgroupPlugin=cgroup/v1"
slurmstepd: fatal: Could not open/read/parse cgroup.conf file
```

**Cause:** known configuration noise in the MiniDMR Docker image. These errors come from Slurm's cgroup plugin, not from DMR.

**Fix:** safe to ignore. They do not affect DMR behaviour.
