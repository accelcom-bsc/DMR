# DMR Common Issues

Full online reference: https://iarejula-bsc.github.io/dmr_doc/user-guide/common-issues

## Runtime symptoms

| What you see | Cause | Fix |
|---|---|---|
| `Could not detect DMR state. Did you launch with the DMR wrapper?` | The binary was launched directly | Launch through the wrapper, inside an allocation |
| `PMIx resource discovery found no allocations` | Usually the wrapper does not match the installed library, e.g. a copy from a source checkout | Use the wrapper installed next to `libdmr` |
| `Placing N process(es) instead of the M asked for` | `DMR_PROCS_PER_NODE` does not match the cores per node | Set it to the real value |
| Undefined reference to `dmr_get_policy_round` | Policy header not declared: missing `DMR_WITH_TEST_POLICIES`, or included from C++ without `extern "C"` | Define the guard and wrap the include |
| The application resumes from its initial condition | The startup path re-imposes it after the state was received | Skip it when `dmr_init` returned `DMR_RESTART_RECONF` |
| Output folder already exists, or the time series restarts | The arriving world re-ran the startup steps that create them | Skip creation, reopen in append mode |
| Output files overwritten or renumbered after a resize | Output counters did not travel with the state | Add them to the transferred state |
| Lines appear twice in the job log | The launcher forwards a spawned world's output more than once | Cosmetic; count distinct entries when scripting on the log |
| The run never resizes, so the test passes trivially | Resource grants are asynchronous and the run finished first | `DMR_BLOCKING_REQ=1`, and fail the test when zero resizes |

## Patterns to flag during code review

| Symptom / pattern | Root cause | Fix |
|---|---|---|
| `dmr_check` inside `if (rank == 0)` | Not all ranks reach the call | Move outside the conditional |
| Local loop variable or local stage variable as progress counter | Resets to `0` on restart from `main()` | Promote to a global variable |
| Non-blocking sends/recvs pending at `dmr_check` | MPI state corruption | Complete with `MPI_Wait/Waitall` first |
| Checkpoint files indexed by rank (`ckpt_rank_%d.bin`) | Load fails when rank count changes after reconfiguration | Key files by global data offset, not rank |
| Intermediate computed data not checkpointed | Silent wrong results after restart | Add to checkpoint or mark as recomputable |
| Redistribution that sends rank *i* to rank *i* | Only correct when the counts divide evenly | Compute the overlap between old and new blocks |
| Redistribution using a partitioning rule other than the application's | Boundaries disagree by a cell or two; data is lost or duplicated silently | Reuse the application's own partitioning function, rounding included |
| `dmr_set_policy` called only on the first launch | Policy is not carried across a relaunch | Call it after every `dmr_init` |
| `dmr_check` called every iteration | A collective per step for nothing | Gate it on a counter that is identical on every rank |
| Sending state before `dmr_reconfigure()` | `DMR_INTERCOMM` does not exist until the incoming world is spawned | Reconfigure first, then send, then finalize |
| `dmr_finalize` placed after `MPI_Finalize` | Undefined behaviour | Swap order: `dmr_finalize` then `MPI_Finalize` |
| Storing the return value of a DMR call and passing it to `DMR_AUTO` | `DMR_AUTO` requires the call expression, not the result | Pass the full call: `DMR_AUTO(dmr_check(...), ...)` |
