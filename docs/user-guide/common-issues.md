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

## No allocations found

**Symptom:**
```
DMR Error: PMIx resource discovery found no allocations.
DMR Error: Something went wrong discovering resources. Aborting.
```

**Cause:** the application was run outside of a Slurm job allocation (e.g. directly from the shell). `dmr_init` learns its allocation from the runtime, which only has one inside a job.

**Fix:** submit via `sbatch` or run inside `salloc`.

---

## dmr can't find the executable

**Symptom:**
```
Error: dmr was not able to find an executable in the provided command
```

**Cause:** `dmr` looks for the executable by scanning the command's arguments for the first one that is either a file that exists and is executable relative to the job's current working directory, or a name resolvable via `PATH`. A relative path (e.g. `./build/my_app`) only works if that working directory is what you think it is -- Slurm jobs default to the submission directory (`$SLURM_SUBMIT_DIR`), not necessarily wherever the batch script file itself lives, especially with nested Slurm setups (Slurm4DMR) or scripts that live in a subdirectory of the project.

**Fix:** use an absolute path to the executable instead of a relative one, e.g. anchored on `$SLURM_SUBMIT_DIR`.

---

## App starts already at full size, no reconfigs happen

**Symptom:** the app runs and finishes immediately, `dmr_check` reports the target size already reached with `0 reconfig(s)` -- it never grows.

**Cause:** `mpirun --host host1:1,host2:1,...` without `-np` uses every slot the hostlist offers, so the app starts at that full size right away instead of at 1 process. `dmr` expects `-np`/`--np` to be present -- it explicitly strips it back out when rebuilding the launch command for each reconfig.

**Fix:** pass `-np 1` (or whatever the intended starting size is) explicitly.

---

## Expansion never completes

**Symptom:** after `dmr_check(SHOULD_EXPAND)` the application keeps running at its current size, and `pending_nodes` in the analytics output stays above zero.

**Cause:** the resource manager has no free nodes to grant. If the job already holds every node available in its partition (e.g. submitted with `--exclusive` over the whole cluster), the request stays pending. `DMR_NODES_IN_EXPAND` (default `1`) matters too: a request for more nodes than are free cannot be served.

**Fix:** leave free nodes in the partition, and keep `DMR_NODES_IN_EXPAND` within the number of free nodes. `dmr_cancel_expansion()` abandons a pending request.

---

## Nodes DMR is not running on

**Symptom:**
```
DMR Error: Allocation <id> holds node(s) that DMR is not running on: <nodes>. Launch DMR on every node of its allocation.
```

**Cause:** `dmr_init` requires the application's processes to cover every node of the allocation. A bare `-np` can pack all processes onto the first nodes.

**Fix:** list every node with `--host`, giving each the number of processes it should run (`host1:2,host2:2`), as in the [launch script](../getting-started/building-and-running#submitting-a-job).

---

## Unsupported `--map-by`

**Symptom:**
```
Error: dmr supports only --map-by slot[:OVERSUBSCRIBE], not <policy>.
```

**Cause:** every reconfiguration places processes by slot, so `dmr` rejects other mapping policies.

**Fix:** use `--map-by slot`, or drop `--map-by`.

---

## Removed CMake setting

**Symptom:** CMake stops, naming a setting removed in 3.0.0 and its replacement.

**Cause:** the setting no longer exists, and ignoring it would change the build.

**Fix:** set the named replacement and remove the old setting, as the message says.

---

## cgroup.conf parse errors in slurm output

**Symptom:**
```
slurmstepd: error: Parse error in file /etc/slurm/cgroup.conf line 1: "CgroupPlugin=cgroup/v1"
slurmstepd: fatal: Could not open/read/parse cgroup.conf file
```

**Cause:** known configuration noise in the MiniDMR Docker image. These errors come from Slurm's cgroup plugin, not from DMR.

**Fix:** safe to ignore. They do not affect DMR behaviour.
