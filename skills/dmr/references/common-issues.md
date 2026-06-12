# DMR Common Issues

Full online reference: https://iarejula-bsc.github.io/dmr_doc/user-guide/common-issues

## Issues to flag during code review

| Symptom / pattern | Root cause | Fix |
|---|---|---|
| `dmr_check` inside `if (rank == 0)` | Not all ranks reach the call | Move outside the conditional |
| Local loop variable or local stage variable as progress counter | Resets to `0` on restart from `main()` | Promote to a global variable |
| Non-blocking sends/recvs pending at `dmr_check` | MPI state corruption | Complete with `MPI_Wait/Waitall` first |
| Checkpoint files indexed by rank (`ckpt_rank_%d.bin`) | Load fails when rank count changes after reconfiguration | Key files by global data offset, not rank |
| Intermediate computed data not checkpointed | Silent wrong results after restart | Add to checkpoint or mark as recomputable |
| No `sleep` between rapid consecutive `SHOULD_EXPAND` calls | Overlapping MPI spawns fail | Add `sleep(1)` before `dmr_check` |
| `dmr_finalize` placed after `MPI_Finalize` | Undefined behaviour | Swap order: `dmr_finalize` then `MPI_Finalize` |
| Storing the return value of a DMR call and passing it to `DMR_AUTO` | `DMR_AUTO` requires the call expression, not the result | Pass the full call: `DMR_AUTO(dmr_check(...), ...)` |
