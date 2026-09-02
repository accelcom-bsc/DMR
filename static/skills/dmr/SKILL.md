---
name: dmr
description: Instruments existing MPI C/C++ applications with DMR (Dynamic MPI Reconfiguration) so they can change process count at runtime without resubmitting the job. Covers the execution model, deciding which state has to travel, placing the lifecycle calls, building and linking against DMR, launching through the wrapper, and verifying that a resize preserves results. Also use when reviewing or debugging existing DMR instrumentation, configuring policies, or setting up a local MiniDMR cluster.
license: GPL-2.0-only
compatibility: Requires a C or C++ MPI application using Open MPI. The target system must run under Slurm. For local testing without a cluster, Docker is required (MiniDMR sandbox).
metadata:
  author: Íñigo Aréjula (BSC)
  version: "2.0"
---

# DMR — Instrumenting MPI Applications for Runtime Malleability

DMR lets an MPI job change its process count while running. Docs:
https://iarejula-bsc.github.io/dmr_doc/

**Read the execution model below before writing any code.** Most failed
integrations come from assuming the wrong model, not from misplacing a call.

---

## The execution model — five facts

1. **Every resize relaunches every process.** The outgoing world exits and the
   new world starts from `main()`. This is true in *both* transfer modes; the
   mode only decides where the data travels. Nothing on the stack survives.
2. **The departing ranks send, the arriving ranks receive, and nobody
   survives in between.** There is no "kept" rank that skips the transfer.
3. **The order on the outgoing side is `dmr_reconfigure()` → send →
   `dmr_finalize()`.** `dmr_reconfigure()` is what spawns the incoming world
   and creates `DMR_INTERCOMM`, so the send cannot precede it. `dmr_finalize()`
   terminates the process.
4. **Only state that changed since the start has to travel.** Anything the
   arriving process can re-read from the input files should be re-read; sending
   it duplicates work the new world does anyway.
5. **Both sides must derive the same partitioning without communicating.** The
   sender computes the receiver's blocks and the receiver computes the sender's,
   so the partitioning function must be deterministic and identical on both
   sides — same formula, same rounding.

Get these right and the rest is mechanical. Get 1 or 4 wrong and the
application silently restarts from its initial condition.

---

## Workflow

1. [Decide what travels](#1-decide-what-travels)
2. [Instrument the lifecycle](#2-instrument-the-lifecycle)
3. [Write the redistribution](#3-write-the-redistribution)
4. [Audit the restart path](#4-audit-the-restart-path)
5. [Build and launch](#5-build-and-launch)
6. [Verify](#6-verify)

Before starting, rule out the hard blockers: the application is not MPI, or no
point exists where all ranks meet unconditionally, or the state that must travel
is so large that moving it costs more than the resize saves. Anything else is a
trade-off, not a blocker — present it and continue.

---

## 1. Decide what travels

Ask one question per piece of state: **has it changed since the run started?**

| Category | Examples | Where it comes back from |
|---|---|---|
| Evolves with the computation | solution fields, accumulators, iteration counter, output counters | must be carried across |
| Read once, never modified | mesh, material properties, masks, boundary conditions | re-read from the input files |
| Scratch within one iteration | flux buffers, temporaries | neither: reallocated |

This classification does not depend on the transfer mode; the medium does.
"Carried across" means written to the checkpoint under checkpoint-restart, and
sent over `DMR_INTERCOMM` under MPI spawn. Under checkpoint-restart everything
that survives does go through disk, but that is not a reason to checkpoint the
static input: the relaunched process re-reads it exactly as it does on a cold
start, so writing it only adds I/O to every reconfiguration.

The criterion outranks the list. A field that is static in one configuration may
evolve in another — a bed elevation is input data until a sediment module starts
moving it. State the criterion in the code so the next person applies it.

Do not forget the bookkeeping: simulated time, iteration index, and the counters
that name output files. If those do not travel, the new world renumbers its
output and overwrites what the previous one wrote.

Produce this table before writing code:

| Variable | Category | Travels? | Reason |
|---|---|---|---|
| `u[local_n]` | evolves | yes | primary field |
| `mesh` | static | no | re-read from input |
| `flux[local_n]` | scratch | no | recomputed every step |
| `step`, `n_output` | evolves | yes | progress and output naming |

---

## 2. Instrument the lifecycle

```c
MPI_Init(&argc, &argv);
// Immediately after MPI_Init, no MPI calls in between
DMR_AUTO(dmr_init(argc, argv), (void)NULL, receive_state(), cleanup());
dmr_set_policy(dmr_get_policy_round());   // re-register on every launch
```

`dmr_set_policy` is not carried across a relaunch. Call it unconditionally after
every `dmr_init`, not only on the first launch.

In the main loop, at a point every rank reaches:

```c
while (current_step < MAX_STEPS) {          // global, restored from the transfer
    do_work();
    current_step++;
    write_output_if_due();
    DMR_AUTO(dmr_check(USE_POLICY), send_state(), (void)NULL, cleanup());
}
```

**Placing `dmr_check`.** It must be a point where every rank arrives
unconditionally, with no non-blocking operation pending and no collective
spanning it. The end of an iteration, after output has been written, is usually
the best: the state that travels and the files on disk then agree, so a rank can
die there without leaving anything half-done.

**`dmr_check` is collective and it costs.** Calling it every iteration is
thousands of collectives for nothing. Gate it:

```c
if (current_step % DMR_CHECK_FREQ == 0)
    DMR_AUTO(dmr_check(USE_POLICY), send_state(), (void)NULL, cleanup());
```

The gate must evaluate identically on every rank — use a replicated counter, not
anything derived from local work.

**When `DMR_AUTO` does not fit.** The macro takes expressions, so callbacks that
need arguments do not fit it. Spell out the same dispatch by hand and keep the
order of fact 3:

```c
if (dmr_check(USE_POLICY) == DMR_RECONF) {
    if (dmr_reconfigure() == DMR_REDIST_FINALIZE) {
        send_state(state, DMR_INTERCOMM);
        dmr_finalize();                    // terminates this process
    }
}
```

See [references/reconfiguration-handling.md](references/reconfiguration-handling.md)
and [references/advanced-usage.md](references/advanced-usage.md).

---

## 3. Write the redistribution

Two transfer modes, chosen when DMR is built (`DMR_CHECKPOINT_RESTART`):

| Mode | How state travels | Use when |
|---|---|---|
| Checkpoint-restart (`=1`, default) | outgoing ranks write files, incoming ranks read them | the application already has checkpointing |
| Intercommunicator (`=0`) | outgoing and incoming worlds coexist briefly and exchange over `DMR_INTERCOMM` | there is no checkpointing, or the state is too large to push through disk |

Both relaunch the process. Only the medium differs.

**The mapping is the hard part, not the transfer.** A rank of the new world
generally overlaps several ranks of the old one. Sending rank *i* to rank *i*
only works when the counts divide evenly; write the general form instead:

```c
// Sender: for each rank of the incoming world, send the part of my block it now owns
for (int dst = 0; dst < new_size; dst++) {
    block_of(dst, new_size, &d0, &d1);          // same function on both sides
    lo = max(my_start, d0); hi = min(my_end, d1);
    if (hi >= lo) MPI_Send(&local[lo - my_start], hi - lo + 1, ..., dst, 0, DMR_INTERCOMM);
}
// Receiver: mirror image over the ranks of the outgoing world
```

`block_of` must reproduce the application's own partitioning exactly, rounding
included. If the application splits a domain with `round(n*p/P)`, a redistribution
using `n/P` plus a remainder disagrees at some boundaries and silently loses or
duplicates cells.

Send the scalar bookkeeping alongside the fields, in the same exchange.

---

## 4. Audit the restart path

Because `main()` runs again (fact 1), everything between the start of the
program and the point where the state is received will run a second time. Go
through the startup path and decide, for each step, whether it must be skipped
when this process is an arriving one (`dmr_init` returned `DMR_RESTART_RECONF`):

- **Imposing the initial condition** — must be skipped, or it overwrites what
  was just received. Watch for initial conditions built *after* the library's
  init function, in the caller.
- **Creating the output directory** — it already exists; creating it fails.
- **Writing headers of time series or log files** — truncates what the previous
  world wrote. Reopen in append mode instead.
- **Writing the initial output snapshot** — duplicates a frame.
- **Resetting counters** — the received values must win over anything the
  startup path sets.

Order matters: receive the state *after* the startup path has allocated and
read the static input, and *before* halo exchanges or boundary conditions are
initialised from it.

---

## 5. Build and launch

See [references/build-and-run.md](references/build-and-run.md), and
[references/minidmr.md](references/minidmr.md) for doing all of this on a local
cluster. The two things that break first:

- **Linking**: DMR installs no CMake package config and no pkg-config file, and
  its optional policy headers are neither included by `dmr.h` nor wrapped in
  `extern "C"`. From C++ they must be included inside an `extern "C"` block, and
  the consumer has to define the guard (`DMR_WITH_TEST_POLICIES`).
- **Launching**: DMR only works through its wrapper, inside a resource manager
  allocation. Use the *installed* wrapper, not a copy from a source tree — a
  mismatched one fails inside `dmr_init` with an error that points at the
  cluster rather than at the wrapper.

---

## 6. Verify

An instrumented application that never resizes proves nothing, and a resize that
silently corrupts state looks exactly like a successful run. Test at three
levels, cheapest first:

1. **The mapping, without MPI or DMR.** Give every cell of the global domain a
   distinct value, run the pack and unpack with the real index arithmetic, and
   require the reconstructed field to match cell by cell — for every rank pair
   in range, including counts that are not multiples of each other. Catches
   off-by-one and rounding mismatches that would otherwise corrupt results
   silently.
2. **Same case, fixed versus malleable.** Run the identical case with a fixed
   process count and with malleability, and compare the final state. A resize
   changes only the partitioning, so both must agree within round-off — not
   bitwise, because the order of reductions changes. Compare the amount of work
   too: a resumed run that repeats work is a restored-progress bug.
3. **Assert that a resize happened.** Without this, level 2 passes trivially
   when the policy never fires. Resource grants are asynchronous, so a short run
   can finish before the expansion arrives; make the test deterministic with
   `DMR_BLOCKING_REQ=1` and fail it when the resize count is zero.

Log one line per world after `dmr_init` (reconfiguration count, process count,
node count) so the sequence is visible in the job output.

See [references/verification.md](references/verification.md), and
[references/minidmr.md](references/minidmr.md) for running these levels locally.

---

## References

- Minimal working example: [references/hello-world.md](references/hello-world.md)
- API: [references/api.md](references/api.md)
- Callbacks and dispatch: [references/reconfiguration-handling.md](references/reconfiguration-handling.md)
- Policies: [references/policies.md](references/policies.md)
- Applications with existing checkpointing: [references/advanced-usage.md](references/advanced-usage.md)
- Building and launching: [references/build-and-run.md](references/build-and-run.md)
- Doing it on a local cluster: [references/minidmr.md](references/minidmr.md)
- Verifying an integration: [references/verification.md](references/verification.md)
- Symptoms and causes: [references/common-issues.md](references/common-issues.md)
