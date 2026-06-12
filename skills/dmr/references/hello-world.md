# DMR Hello World — Minimal Loop Example

A complete, compilable DMR program. This is the smallest correct DMR application:
an iterative loop that checkpoints progress state so reconfiguration can resume
from the right iteration.

```c
#include <mpi.h>
#include <stdio.h>
#include "dmr.h"

// Global — must NOT be a local variable; it must survive the restart from main()
// that happens after a reconfiguration.
int current_i = 0;

typedef struct { int i; } AppState;

void save_state(void) {
    AppState s = { .i = current_i };
    FILE *f = fopen("checkpoint.bin", "wb");
    fwrite(&s, sizeof(s), 1, f);
    fclose(f);
}

void load_state(void) {
    FILE *f = fopen("checkpoint.bin", "rb");
    if (f) {
        AppState s;
        fread(&s, sizeof(s), 1, f);
        fclose(f);
        current_i = s.i;
    }
}

void do_work(int step) {
    int rank;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    if (rank == 0)
        printf("Step %d\n", step);
}

int main(int argc, char *argv[]) {
    MPI_Init(&argc, &argv);

    // On first launch: dmr_init returns DMR_NO_ACTION, load_state() is skipped.
    // After a reconfiguration restart: dmr_init returns DMR_RESTART_RECONF,
    // DMR_AUTO calls load_state() to restore current_i before the loop starts.
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, load_state(), (void)NULL);

    while (current_i < 10) {
        // Top of loop: all ranks are here simultaneously, no collectives in flight.
        // If reconfiguration fires, save_state() writes current_i to disk,
        // then all ranks restart main() with the new process count and load it back.
        DMR_AUTO(dmr_check(SHOULD_EXPAND), save_state(), (void)NULL, (void)NULL);

        do_work(current_i);
        current_i++;
    }

    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, (void)NULL);
    MPI_Finalize();
    return 0;
}
```

## Key decisions explained

**`current_i` is a global, not a local**

If `current_i` were declared inside `main()`, it would reset to `0` every time
the process restarts after reconfiguration — producing an infinite loop.
Declaring it as a file-scope global means it survives until `load_state()` sets
it to the correct value from the checkpoint.

**`dmr_check` at the top of the loop, before `do_work`**

The checkpoint is taken *before* the work of iteration `i`, so `load_state()`
restores `current_i = i` and the loop body re-executes iteration `i` cleanly.
If `dmr_check` were placed after `current_i++`, the checkpoint would record
`i+1` but the work for `i` would not be re-done — correct only if `do_work` is
idempotent.

**`(void)NULL` for unused callbacks**

`DMR_AUTO` requires all four arguments. Pass `(void)NULL` for any callback that
is not needed — never omit a parameter.

**`SHOULD_EXPAND` as the suggestion**

This tells the policy to request more nodes at this point if possible. Use
`USE_POLICY` to let the configured policy decide, `SHOULD_SHRINK` to release
nodes, or `ROUND_POLICY` to alternate.

## What this example omits

This example only saves progress state (the loop counter). A real application
would also checkpoint distributed data arrays in `save_state()` / `load_state()`
and redistribute them across the new rank count after restart.
See [Phase 2](../SKILL.md#phase-2--identify-the-state-to-save) of the main skill
for the full data-state analysis.
