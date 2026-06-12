---
name: dmr
description: Instruments existing MPI C/C++ applications with DMR (Dynamic MPI Reconfiguration) to enable runtime node scaling without restarting the job. Covers the full workflow: evaluating fitness, analysing program structure, identifying state to checkpoint, placing dmr_init/dmr_check/dmr_finalize, and verifying collective safety. Also use when reviewing or debugging existing DMR instrumentation, configuring reconfiguration policies, or setting up a local MiniDMR cluster for testing.
license: GPL-2.0-only
compatibility: Requires a C or C++ MPI application using Open MPI. The target system must run under Slurm. For local testing without a cluster, Docker is required (MiniDMR sandbox).
metadata:
  author: Íñigo Aréjula (BSC)
  version: "1.0"
---

# DMR — Instrumenting MPI Applications for Runtime Malleability

DMR adds **runtime malleability** (dynamic node scaling) to MPI applications without restarting the job.
Docs: https://iarejula-bsc.github.io/dmr_doc/

**Always use this skill before writing or modifying any DMR-related code.**

- Minimal working example: [references/hello-world.md](references/hello-world.md)
- Full API reference: [references/api.md](references/api.md)
- Policies — choosing, configuring, combining: [references/policies.md](references/policies.md)
- Reconfiguration handling and callbacks: [references/reconfiguration-handling.md](references/reconfiguration-handling.md)
- Advanced usage (pre-existing CR, without DMR_AUTO): [references/advanced-usage.md](references/advanced-usage.md)
- Common runtime errors: [references/common-issues.md](references/common-issues.md)

---

## Instrumentation workflow — 6 phases in order

**Do not skip phases or jump to code generation early.**

0. **[Phase 0] Evaluate fitness for DMR** — decide if DMR is appropriate before touching the code
1. **[Phase 1] Analyse the program** — map structure, collectives, branches, existing checkpoint logic
2. **[Phase 2] Identify the state to save** — what must survive a reconfiguration (progress + data)
3. **[Phase 3] Place `dmr_init` and `dmr_finalize`** — mechanical, but must be correct
4. **[Phase 4] Find safe synchronisation points for `dmr_check`** — the most critical phase
5. **[Phase 5] Collective safety checklist** — verify no races before finalising

---

## Phase 0 — Evaluate fitness for DMR

Before any instrumentation, assess whether DMR is the right tool for this application. Present this evaluation to the user clearly, with a recommendation.

### ✅ DMR is a good fit when

- **The application is MPI-based and has explicit synchronisation points** — either a main loop where all ranks meet periodically, or a sequential pipeline of distinct stages. Reconfiguration in DMR only happens where the application explicitly calls `DMR_AUTO(dmr_check(...))` — DMR never stops execution at arbitrary points. There must be at least one such call that all ranks reach unconditionally.
- **There are phases with different resource needs** — e.g. a memory-bound I/O phase that needs few nodes followed by a compute-intensive phase that benefits from many. This is the ideal use case: DMR can shrink for the light phase and expand for the heavy one, releasing resources to the cluster queue in between.
- **A brief pause at each `dmr_check` call is tolerable** — the process set change happens at the explicit `DMR_AUTO` call site and is not instantaneous (Slurm must grant resources). If the gap between consecutive `dmr_check` calls is very short (< seconds), the reconfiguration overhead may dominate.
- **The application already has checkpoint-restart** — integration is minimal: hook existing save/load into `redist_func`/`restart_func` and add `dmr_check`. This is the best-case scenario.

### ❌ DMR is a poor fit when

- **No clear synchronisation points exist** — tightly coupled applications with no loop structure or where all ranks are always in flight have nowhere safe to call `dmr_check`.
- **State save/restore cost is prohibitive** — if the distributed data is so large that writing a checkpoint at every potential reconfiguration point dominates wall time, the overhead outweighs the benefit. Estimate: checkpoint write time should be a small fraction of one iteration time.
- **The application is not MPI-based** — DMR only works with Open MPI.
- **The application runs outside Slurm** — DMR requires `SLURM_JOB_ID` to be set; it cannot run from a plain shell.

### Trade-off summary to present to the user

| Aspect | Impact |
|---|---|
| Scale up/down without resubmitting | Keeps queue position, avoids full restart |
| Release idle resources between phases | Improves overall cluster utilisation |
| Reconfiguration latency | Depends on queue pressure; can be seconds to minutes |
| Checkpoint overhead | Must be measured; may negate benefit for large state |
| Integration cost | Near-zero with existing checkpoint-restart; moderate otherwise |

### How to identify phases with different resource needs

Look for these patterns in the code or ask the user:

- **Sequential phases** separated by barriers or file I/O: e.g. `init → solve → post-process`. Different phases may scale differently.
- **Convergence-driven loops** where early iterations are cheap and later ones expensive (or vice versa) — node count could track workload.
- **Comments or documentation** mentioning "compute-intensive", "memory-bound", "I/O phase", or profiling data showing uneven resource use across the run.
- **Explicit phase variables** like `stage`, `phase_id`, or mode switches in the main loop.

If distinct phases are identified, note them and their relative resource needs — this informs where to place `dmr_check` calls and which policy hint (`SHOULD_EXPAND` vs `SHOULD_SHRINK` vs `USE_POLICY`) to use at each one.

### Output of Phase 0

Produce a brief assessment:
1. **Verdict**: suitable / unsuitable / suitable with caveats
2. **Reason**: which criteria are met or not
3. **Phases identified** (if any) and their relative resource needs
4. **Checkpoint situation**: existing / needs to be added
5. **Estimated integration effort**: trivial / moderate / high

If unsuitable, stop here and explain why. Do not proceed to Phase 1.

---

## Phase 1 — Analyse the program

Before writing any code, answer these questions from the source:

### 1a. Locate MPI_Init and MPI_Finalize
Find the exact lines of `MPI_Init` / `MPI_Init_thread` and `MPI_Finalize`. These are the anchors for Phase 3.

### 1b. Map the execution structure
Identify how the program is organised at the top level. There are two common patterns — both are valid DMR targets:

- **Iterative loop** — a main loop drives the computation (time-step loop, solver iteration, particle advance, etc.). Note whether loop progress is tracked by a local variable on the stack (must be promoted to global) or already a global/persistent one.
- **Sequential pipeline of stages** — the program executes a fixed sequence of distinct phases one after another (e.g. `init → assemble → solve → post-process → output`) with no enclosing loop. A reconfiguration can happen at any stage boundary where all ranks are simultaneously quiescent. The progress state here is the current stage index, not a loop counter.

Both patterns can coexist (e.g. a loop that advances through named stages). Note which applies and list all natural boundaries — these are the candidates for Phase 4.

### 1c. Catalogue all collective MPI calls
List every collective call and its location in the control flow:
```
MPI_Barrier, MPI_Bcast, MPI_Scatter, MPI_Gather, MPI_Allreduce,
MPI_Allgather, MPI_Alltoall, MPI_Reduce, MPI_Scan, MPI_Exscan,
MPI_Win_fence, MPI_Win_lock_all, MPI_File_* collective I/O, etc.
```
`dmr_check` is itself collective — it must be called by ALL ranks at the same time, with no other collective in flight. This list feeds directly into Phase 4.

### 1d. Identify conditional branches that differ across ranks
Look for code paths gated on rank or process count:
```c
if (rank == 0) { ... }          // rank-0-only code
if (rank < some_threshold) { }  // partial-rank code
```
A `dmr_check` must never be placed inside a branch that only some ranks enter. Flag these locations — they are unsafe zones for Phase 4.

### 1e. Check for existing checkpoint logic

Ask the developer whether the program already saves/restores state (HDF5 dumps, restart files, `fwrite` checkpoints, framework-level CR). If yes, the integration effort depends heavily on *how* that mechanism works — do not assume it fits `DMR_AUTO` without asking:

**Questions to ask when existing CR is found:**

1. **How is the checkpoint triggered?** Is it a plain callable function (e.g. `save_state()`), or is it wired into a signal handler, `atexit`, `MPI_Finalize`, or the application's own shutdown path?
2. **Is it a single function or spread across the code?** `DMR_AUTO` expects a single expression for `redist_func` and `restart_func`. If the logic is scattered, it may need to be wrapped first.
3. **Does the app handle its own process termination after checkpointing?** If the existing CR calls `MPI_Finalize` or `exit()` internally, it will conflict with `DMR_AUTO`'s own rank-exit flow.
4. **What does restart look like?** Does the program re-enter from `main()` and read a checkpoint file, or does it use a different mechanism (e.g. fork, persistent process, framework restart)?

**Based on the answers:**

- **Clean callable functions, no self-termination** → the existing functions can be used directly as `redist_func` / `restart_func` in `DMR_AUTO`. Integration is minimal.
- **CR embedded in shutdown or signal handling** → `DMR_AUTO` will likely conflict. Use the manual dispatch pattern instead, or re-package the CR logic into standalone functions. See [references/advanced-usage.md](references/advanced-usage.md).
- **No existing CR** → Phase 2 will define checkpoint functions from scratch.

Present this assessment to the developer and agree on the approach before proceeding.

### 1f. Choose a reconfiguration policy

Use the information gathered in phases 1b and 0 to select a policy. Record the choice and the reason — it feeds directly into Phase 4 (which `DMRSuggestion` to pass to `dmr_check`).

**Decision guide:**

| Situation identified in analysis | Policy |
|---|---|
| Distinct phases with known resource needs (identified in Phase 0) | Manual control: `SHOULD_EXPAND` / `SHOULD_SHRINK` from a `decide()` function |
| No distinct phases; want automatic cycling across a node range | `ROUND_POLICY` |
| TALP available and workload communication pattern is variable | `CE_POLICY` |
| Running under Slurm4DMR | `SLURM4DMR_ROUND_POLICY`, `SLURM4DMR_CE_POLICY`, or `SLURM4DMR_QUEUE_POLICY` |
| Benchmarking / stress-testing checkpoint-restart at many sizes | `LIST_POLICY` |

**Important:** DMR has no custom policy plugin interface. If none of the built-in policies fits, the pattern is to write a plain `decide()` function in application code that returns `SHOULD_EXPAND`, `SHOULD_SHRINK`, or `SHOULD_STAY`, and pass its result to `dmr_check`:

```c
DMRSuggestion decide(void) {
    // any logic here: phase index, node count, elapsed time, workload metric, …
    if (app_needs_more_nodes())
        return SHOULD_EXPAND;
    if (app_can_release_nodes())
        return SHOULD_SHRINK;
    return SHOULD_STAY;
}

// in the main loop:
DMR_AUTO(dmr_check(decide()), save(), (void)NULL, cleanup());
```

Common patterns for `decide()`: phase-driven scaling (shrink before communication-heavy phases, expand before compute-heavy ones) and time-window scaling (request resources early, cancel if deadline is near). See [references/policies.md](references/policies.md) for worked examples of both.

---

## Phase 2 — Identify the state to save

This is the foundation of correct checkpoint-restart. When a reconfiguration fires, **the executable restarts from `main()` with a new process count** — all local variables are lost. The checkpoint must capture everything needed to resume correctly.

There are two categories of state to identify:

### 2a. Progress state (the "where are we" state)

This is the minimal scalar information needed to know how far the computation has advanced. It depends on the execution structure identified in Phase 1b:

**For iterative loops:**
- The **loop counter or iteration index** (e.g. `current_step`, `iter`, `t` in a time-stepper)
- Any **convergence tracking variables** (e.g. `residual`, `error`, `converged` flag)

**For sequential stage pipelines:**
- The **current stage index** or an enum/flag indicating which stage has completed (e.g. `current_stage = STAGE_SOLVE`)
- On restart, the program reads this and jumps directly to the next stage — no loop needed

**For both:**
- Any global scalar that determines what to do next

These are almost always single integers, enums, or doubles. They must be **global variables** (not local) so they survive between the checkpoint write and the next `main()` call.

```c
// Iterative loop — promote local counter to global
// Before: int step = 0; while (step < N) { ...; step++; }
int current_step = 0;
int main(...) { while (current_step < N) { ...; current_step++; } }

// Sequential stages — use a global stage marker
typedef enum { STAGE_INIT, STAGE_ASSEMBLE, STAGE_SOLVE, STAGE_POSTPROC } Stage;
Stage current_stage = STAGE_INIT;
int main(...) {
    // after load_checkpoint(), current_stage reflects where we left off
    if (current_stage <= STAGE_ASSEMBLE) { assemble(); current_stage = STAGE_SOLVE; }
    if (current_stage <= STAGE_SOLVE)    { solve();    current_stage = STAGE_POSTPROC; }
    ...
}
```

### 2b. Computation data state (the "what have we computed" state)

This is the distributed data that each rank holds. Identify:

- **Distributed arrays** — the primary domain data partitioned across ranks (e.g. velocity field, particle positions, matrix rows, grid cells)
- **Derived/intermediate arrays** — values computed from the primary data that are expensive to recompute (e.g. preconditioners, factored matrices, neighbour ghost cell buffers)
- **Solver internal state** — if using an iterative solver, its internal vectors (Krylov subspace, previous iterates, etc.)
- **Global scalar accumulators** — values built up across iterations (e.g. total energy, accumulated error)

For each item, decide: **can it be recomputed cheaply from the primary data after restart?** If yes, it does not need to be checkpointed. If no, it must be saved.

### 2c. Checkpoint format: rank-agnostic is mandatory

After reconfiguration the number of ranks changes. A checkpoint format that ties data to a specific rank count will fail to load. Use one of:

- **Single global file** — rank 0 gathers all data and writes one file. Simple but requires a full gather, which may be expensive for large data.
- **MPI-IO collective write** — all ranks write to a shared file using `MPI_File_write_at`. Layout must be described by global offset, not rank index.
- **Per-rank files with a manifest** — each rank writes `ckpt_<global_offset>.bin` keyed by data offset, not rank number. Rank 0 writes a manifest with the total size and partition table. On load, the new ranks read whichever slices cover their new domain.

Never use `ckpt_rank_%d.bin` keyed by rank — it breaks when rank count changes.

### 2d. Summary table (fill this in during analysis)

Produce a table like this before writing any checkpoint code:

| Variable | Type | Category | Must save? | Reason |
|---|---|---|---|---|
| `step` | `int` | Progress | Yes | Loop counter, resets on restart |
| `u[local_n]` | `double*` | Data | Yes | Primary field, cannot recompute |
| `residual` | `double` | Progress | Yes | Convergence state |
| `tmp_buf[n]` | `double*` | Data | No | Recomputed each iteration |

---

## Phase 3 — Place `dmr_init` and `dmr_finalize`

These placements are mechanical once Phase 2 is done (because `load_checkpoint` and `save_checkpoint` are now defined).

```c
MPI_Init(&argc, &argv);
// Immediately after MPI_Init — no MPI calls in between
DMR_AUTO(dmr_init(argc, argv), (void)NULL, load_checkpoint(), cleanup());
//                                          ^^^^^^^^^^^^^^^^   ^^^^^^^^^
//                                          on restart after   on process exit
//                                          reconfiguration
```

```c
// Immediately before MPI_Finalize — no MPI calls after it
DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
MPI_Finalize();
```

**Rules:**
- `dmr_init` immediately after `MPI_Init` — no MPI calls in between.
- `dmr_finalize` immediately before `MPI_Finalize` — no MPI calls after it.
- `dmr_init` is collective: all ranks must reach them.

If the app already has checkpoint functions, wire them in here. Otherwise use the functions defined in Phase 2.

---

## Phase 4 — Find safe synchronisation points for `dmr_check`

This is the most critical phase. A **synchronisation point** is any location in the code where all ranks are simultaneously idle and the computation state is consistent. It does not have to be inside a loop — a transition between sequential stages is equally valid.

### Types of synchronisation points to look for

- **Top or bottom of the main iteration loop** — the most common case. All ranks reach it every iteration.
- **Stage boundary in a sequential pipeline** — between two distinct computation phases (e.g. after `assemble()` completes and before `solve()` begins). If different stages have different resource needs (identified in Phase 0), placing `dmr_check` here allows scaling up or down specifically for that transition.
- **After a collective that all ranks already participate in** — e.g. immediately after an `MPI_Barrier` or `MPI_Allreduce` that already exists in the code, since all ranks are guaranteed to be at the same point.

A single well-chosen point per iteration or per stage transition is enough for most applications.

### ✅ Criteria for a safe dmr_check placement

1. **All ranks reach it unconditionally** — no surrounding `if (rank == X)` or any other rank-diverging branch.
2. **No collective call is in flight** — `dmr_check` must not be called while another collective is pending (e.g. inside a non-blocking collective window or between `MPI_Isend` and `MPI_Wait`).
3. **It is at a quiescent computation boundary** — between iterations, between stages, or between phases. Not mid-computation where partial results would be lost.
4. **No pending non-blocking operations** — all `MPI_Isend` / `MPI_Irecv` must be completed with `MPI_Wait` / `MPI_Waitall` before this point.
5. **The checkpoint at this point is complete** — the state identified in Phase 2 is fully consistent here. Do not place `dmr_check` after `current_step++` if the checkpoint was designed to be taken before it.

### ❌ Unsafe placements and their corrections

```c
// WRONG: dmr_check inside a rank-conditional branch — other ranks never reach it → deadlock
if (rank == 0) {
    DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup());
    rank0_work();
}
// CORRECT: move dmr_check outside the conditional so all ranks reach it
DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup());
if (rank == 0) {
    rank0_work();
}

// WRONG: non-blocking operation still pending at dmr_check — MPI state corruption
MPI_Isend(buf, n, MPI_DOUBLE, dest, tag, MPI_COMM_WORLD, &req);
DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup()); // req still open
MPI_Wait(&req, &status);
// CORRECT: complete all non-blocking operations before dmr_check
MPI_Isend(buf, n, MPI_DOUBLE, dest, tag, MPI_COMM_WORLD, &req);
MPI_Wait(&req, &status);
DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup());

// WRONG: local loop counter — i resets to 0 on reconfiguration restart → infinite loop
for (int i = 0; i < N; i++) {
    DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup());
    do_work(i);
}
// CORRECT: same placement — make i global and include it in the checkpoint
int current_i = 0;  // global; save() persists it, dmr_init restores it on restart
for (; current_i < N; current_i++) {
    DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup());
    do_work(current_i);
}

// WRONG: non-blocking collective not yet completed — same issue as MPI_Isend above
MPI_Ibcast(buf, n, MPI_DOUBLE, 0, MPI_COMM_WORLD, &req);
DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup()); // collective not complete
MPI_Wait(&req, &status);
// CORRECT: wait for the collective to finish before dmr_check
MPI_Ibcast(buf, n, MPI_DOUBLE, 0, MPI_COMM_WORLD, &req);
MPI_Wait(&req, &status);
DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup());
```

### ✅ Safe placement patterns

**Pattern A — iterative loop (global counter):**
```c
int current_step = 0;  // global, persisted via checkpoint

while (current_step < MAX_STEPS) {
    // Top of loop: all ranks here, no collectives in flight
    DMR_AUTO(dmr_check(USE_POLICY), save_checkpoint(), (void)NULL, cleanup());
    do_work(current_step);
    current_step++;
}
```

**Pattern B — sequential stage pipeline:**
```c
// After completing stage A, before starting stage B
stage_A();
DMR_AUTO(dmr_check(SHOULD_SHRINK), save_checkpoint(), (void)NULL, cleanup());
// ^ shrink hint: stage B needs fewer resources than stage A
stage_B();
DMR_AUTO(dmr_check(SHOULD_EXPAND), save_checkpoint(), (void)NULL, cleanup());
// ^ expand hint: stage C is compute-heavy
stage_C();
```

**Pattern C — existing barrier already in code:**
```c
// There is already an MPI_Barrier here; all ranks are guaranteed to be at this point
MPI_Barrier(MPI_COMM_WORLD);
DMR_AUTO(dmr_check(USE_POLICY), save_checkpoint(), (void)NULL, cleanup());
// the barrier above is now redundant (dmr_check is itself a sync), but harmless
```

---

## Phase 5 — Collective safety checklist

Run through this for every `dmr_check` placement before generating the final code:

- [ ] Is this point reachable by **all** ranks without any conditional?
- [ ] Are all non-blocking operations (`MPI_Isend/Irecv/Ibcast/...`) completed with `MPI_Wait/Waitall` before this point?
- [ ] Is there no blocking collective that spans across this point (starts before, ends after)?
- [ ] Does the progress variable (loop counter or stage index) use a **global/persistent** variable from Phase 2, not a local stack variable?
- [ ] If reconfiguration fires here, does `load_checkpoint()` restore **all** state from Phase 2 — both progress state and data state?
- [ ] Is the checkpoint format rank-agnostic (no `ckpt_rank_%d.bin`)?
- [ ] If consecutive `SHOULD_EXPAND` calls are possible, is there a `sleep(1)` before `dmr_check` to avoid overlapping MPI spawns?

---

## When in doubt, consult the docs

| Topic | URL |
|---|---|
| Is DMR right for my app? | https://iarejula-bsc.github.io/dmr_doc/getting-started/quick-start |
| Application structure & lifecycle | https://iarejula-bsc.github.io/dmr_doc/user-guide/app-structure |
| Finding reconfiguration points | https://iarejula-bsc.github.io/dmr_doc/getting-started/quick-start#finding-good-reconfiguration-points |
| Data redistribution strategies | https://iarejula-bsc.github.io/dmr_doc/user-guide/data-redistribution |
| Policies overview | https://iarejula-bsc.github.io/dmr_doc/user-guide/policies/overview |
| Core API reference | https://iarejula-bsc.github.io/dmr_doc/api/core-api |
| Policy API reference | https://iarejula-bsc.github.io/dmr_doc/api/dmr-policies-h |
| Common runtime errors | https://iarejula-bsc.github.io/dmr_doc/user-guide/common-issues |
