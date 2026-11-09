# Building and Launching a DMR Application

## Linking against DMR

DMR installs headers and `libdmr` but **no CMake package config and no
pkg-config file**, so `find_package(DMR)` finds nothing on its own. Either link
by hand with `-ldmr`, or write a small find module:

```cmake
find_path(DMR_INCLUDE_DIR dmr.h)
find_library(DMR_LIBRARY NAMES dmr)
include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(DMR REQUIRED_VARS DMR_LIBRARY DMR_INCLUDE_DIR)
```

If DMR lives outside the default search paths, pass
`-DDMR_INCLUDE_DIR=... -DDMR_LIBRARY=...`.

## Including the headers from C++

`dmr.h` wraps the core headers in `extern "C"`, but:

- it does **not** include the optional policy headers (`dmr_test_policies.h`,
  `dmr_CE_policy.h`), and
- those headers carry no `extern "C"` guard of their own, and
- their declarations sit behind a guard the **consumer** must define
  (`DMR_WITH_TEST_POLICIES`, `DMR_WITH_CE_POLICY`).

So from C++:

```c
#include <dmr.h>
extern "C" {
#include <dmr_test_policies.h>
}
```

plus `-DDMR_WITH_TEST_POLICIES` (or the CMake equivalent) in the build. Without
the guard the declaration is invisible; without `extern "C"` the symbol is
mangled. Both fail at link time with an undefined reference to a policy
constructor.

## Transfer mode

`DMR_CHECKPOINT_RESTART` is a **DMR build option**, not an application one. The
intercommunicator path requires DMR itself to have been built with
`DMR_CHECKPOINT_RESTART=0`. Do not assume it: call `dmr_intercomm_available()`
and fail with a clear message when the installed library was built the other
way.

## Launching

DMR runs only through its wrapper, inside a resource manager allocation:

```bash
srun -N <max_nodes> -n <initial_ranks> dmr mpirun -np <initial_ranks> ./app args...
```

Points that cost the most time when they are wrong:

- **Use the installed wrapper**, the one shipped next to `libdmr` and on `PATH`.
  A copy from a source checkout can be a different version, and the mismatch
  surfaces inside `dmr_init` as `PMIx resource discovery found no allocations`,
  which reads like a cluster problem rather than a wrapper problem.
- **Ask for as many nodes as the maximum size the run may reach.** DMR expands
  into the allocation; it cannot exceed it.
- **`DMR_PROCS_PER_NODE` must match the cores per node.** Otherwise DMR asks for
  many more processes than there are slots and the placement is refused.
- **The working directory must be on a filesystem every node sees.** The job
  runs on compute nodes, which do not share `/tmp` with the submitting node.
  Output written to a private `/tmp` disappears from the point of view of the
  next world.

## Useful environment variables

| Variable | Effect |
|---|---|
| `DMR_DEFAULT_POLICY_MIN` / `MAX` | node range a policy may move within |
| `DMR_PROCS_PER_NODE` | processes placed per node |
| `DMR_BLOCKING_REQ=1` | `dmr_check` waits for the resources instead of polling once; makes short runs deterministic |
| `DMR_PRINT_ANALYTICS=1` | prints DMR's own metrics per event; off by default |
| `DMR_DEBUG_LEVEL` | DMR internal tracing, useful when `dmr_init` aborts |

All of them override the compiled default at runtime.

## Reading the job log

The launcher forwards the output of a spawned world more than once, so lines
printed by any world after the first appear duplicated in the job log. This is
not the application printing twice: it happens whatever the process prints and
whenever it prints it. Anything that counts events by grepping the log must
count distinct entries, not raw lines.
