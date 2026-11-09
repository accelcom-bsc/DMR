# Verifying a DMR Integration

A resize that corrupts state looks like a normal run, and an instrumented
application that never resizes looks like a passing test. Verify at three
levels.

## Level 1 — the mapping, without MPI or DMR

The redistribution mapping is pure arithmetic, so it can be tested as such: no
launcher, no allocation, no library. Give every cell of the global domain a
distinct value, run the pack and unpack with the same index arithmetic the real
transfer uses, and require the reconstructed field to match cell by cell.

```c
for (old_size = 1; old_size <= N; old_size++)
  for (new_size = 1; new_size <= N; new_size++)
      check_resize(nx, ny, old_size, new_size);
```

Cover every pair in range, including counts that are not multiples of each
other (3→5, 7→2), and use domain sizes that do not divide evenly, so rounding is
exercised. Checking only that each cell is transferred *once* is not enough: it
passes even when values land in the wrong place. Compare values.

This is the test that catches the failure mode nothing else catches — a
mapping that silently misplaces data instead of crashing.

## Level 2 — same case, fixed versus malleable

Run the identical case twice: once with a fixed process count on a build without
DMR, once with malleability enabled. Compare the final state.

- **Tolerance, not bitwise.** Changing the process count changes the order of
  the reductions, so results differ in the last bits. Compare relative
  differences against a tolerance.
- **Compare the amount of work too**, not only the final state. A resumed run
  that repeats work still ends at the right answer. Comparing the number of
  output records or iterations catches a restart that resumed from the wrong
  point.

## Level 3 — assert that a resize actually happened

Level 2 passes trivially when the policy never fires, which is a false green.
Resource grants are asynchronous: `dmr_check` polls once and returns, so a short
run can finish before the expansion is granted.

- Set `DMR_BLOCKING_REQ=1` so the check waits for the resources. This makes the
  resize deterministic instead of a race against the run's duration.
- Fail the test when the number of resizes is zero, and print the sequence of
  worlds so a reviewer can see what was exercised.

## Making the sequence visible

Log one line per world, right after `dmr_init`, from one rank:

```c
if (rank == 0)
    printf("DMR reconfiguration %d: %d ranks on %d nodes\n",
           dmr_get_reconfig_count(), world_size, dmr_get_current_node_count());
```

Reading it back gives the resize sequence directly:

```
DMR reconfiguration 0: 1 ranks on 1 nodes
DMR reconfiguration 1: 2 ranks on 2 nodes
DMR reconfiguration 2: 1 ranks on 1 nodes
```

The launcher forwards a spawned world's output more than once, so count
distinct entries rather than raw lines when a script consumes this.
