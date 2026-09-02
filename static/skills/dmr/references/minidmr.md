# Using MiniDMR to Build, Run and Verify

MiniDMR is a local Docker-based Slurm cluster that ships DMR in its image. It is
enough to develop and verify an integration end to end without a real cluster.

## Start a cluster

```bash
minidmr start -n 4 -i <minidmr image>
```

`-n` is the number of `slurmd` nodes, four by default, **one core each**. A run
can never exceed the cluster, so start at least as many nodes as the maximum
size the application is allowed to reach. Since each node has one core, the
total rank count is bounded by the node count.

Other commands: `minidmr exec -- <cmd>` runs on the controller (the form to use
in scripts), `minidmr enter` opens an interactive shell, `minidmr srun` and
`minidmr sbatch` submit jobs, `minidmr stop` removes the cluster.

## What is already in the image

DMR needs no installation: headers, `libdmr` and the `dmr` wrapper ship with the
image, under the standard prefixes and on `PATH`. Before instrumenting, check
how that copy was built — the transfer mode is a build option of the library, not
of the application:

```bash
minidmr exec -- sh -c 'ls /usr/local/include/dmr*.h; ls /usr/local/lib/libdmr*'
minidmr exec -- grep -iE "CHECKPOINT_RESTART|USE_TALP" /opt/dmr/build/CMakeCache.txt
```

An image built with `DMR_CHECKPOINT_RESTART=0` supports the intercommunicator
path; one built with `=1` does not, and `dmr_intercomm_available()` will say so
at runtime.

## Installing what the application needs

```bash
minidmr install --controller-only <packages>          # on a running cluster
minidmr start ... --packages-file packages.json       # at cluster creation
```

The manifest takes `packages` and `controller_packages`:

```json
{ "controller_packages": ["gcc-toolset-13"] }
```

Compilers only need to be on the controller, which is where the build runs; the
compute nodes only execute the binary. Note that `start --packages-file` may
return before the installation has finished, so verify the package is there
before building, and fall back to `minidmr install`.

Dependencies that are not in the distribution repositories have to be built
inside the container. Put them under `/tmp` and remember they are lost when the
cluster is recreated, so keep that step in a script and rerun it after every
`start`.

## Filesystem model — the rule that bites

The host `$HOME` is bind-mounted into every container, so anything under it is
shared by all nodes. **`/tmp` is private to each container.**

- Build in the shared tree, not in `/tmp`.
- Write run outputs to the shared tree too. A job launched from the controller
  runs on a compute node, which does not see the controller's `/tmp`; output
  written there vanishes from the point of view of the next world.
- Tools built into `/tmp` exist only on the node that built them.

## Build inside the cluster

Compile through `minidmr exec` rather than on the host, so the toolchain and
libraries match the ones the job will run against:

```bash
minidmr exec -- sh -c '
source /opt/rh/<toolset>/enable
cmake -S . -B build-dmr -DCMAKE_BUILD_TYPE=Release <dmr flags>
cmake --build build-dmr -j4
'
```

For the fixed-versus-malleable comparison, keep two build directories: one
without DMR for the reference run, one with it.

## Run a malleable job

DMR needs an allocation and its wrapper:

```bash
minidmr exec -- sh -c '
cd <shared work dir>
DMR_DEFAULT_POLICY_MIN=1 DMR_DEFAULT_POLICY_MAX=2 DMR_PROCS_PER_NODE=1 DMR_BLOCKING_REQ=1 \
  srun -N 2 -n 1 dmr mpirun -np 1 ./build-dmr/app args...
'
```

- `DMR_PROCS_PER_NODE=1` matches MiniDMR's one core per node. Leaving it wrong
  makes DMR ask for far more processes than there are slots.
- `DMR_BLOCKING_REQ=1` makes `dmr_check` wait for the granted nodes. Without it
  the grant is asynchronous and a short run can finish before the expansion
  arrives, so the test passes without ever resizing.
- `-N` must cover the maximum size the policy may reach.

## Verify

Level 1 of [verification.md](verification.md) is a plain binary, so it runs
directly:

```bash
minidmr exec -- ./build-dmr/tests/redistribution_test
```

Levels 2 and 3 need the allocation, so they go through the command above, driven
by a script that runs the fixed case, runs the malleable one, and compares. Keep
the script in the application repository: it is the reproducible part of the
integration.

## Debugging inside the cluster

- `DMR_DEBUG_LEVEL=3` traces DMR's own progress and shows exactly where
  `dmr_init` gives up.
- `DMR_PRINT_ANALYTICS=1` adds DMR's metrics per event; off by default.
- When the job log is ambiguous — the launcher forwards a spawned world's output
  more than once — have each rank append its identity (host, pid, rank, world
  size) to a file on the shared filesystem. A file written by the processes
  themselves settles what actually ran, which stdout cannot.
- Container images are minimal and may lack `ps`; read `/proc/*/cmdline`
  instead:
  ```bash
  docker exec <node> sh -c 'for p in /proc/[0-9]*; do tr "\0" " " < $p/cmdline; echo; done'
  ```
- Recreating the cluster resets `/tmp`, which is the quickest way to test that
  the documented setup steps are complete.
