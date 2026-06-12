# DMR Policies

Full online docs: https://iarejula-bsc.github.io/dmr_doc/user-guide/policies/overview

## Choosing a policy

| Situation | Policy to use |
|---|---|
| Testing or benchmarking — cycle through a fixed range | `ROUND_POLICY` |
| Cycling through an explicit sequence of sizes | `LIST_POLICY` |
| Production — auto-tune based on communication efficiency | `CE_POLICY` (requires TALP) |
| Slurm4DMR mode — cycling | `SLURM4DMR_ROUND_POLICY` |
| Slurm4DMR mode — auto-tune | `SLURM4DMR_CE_POLICY` |
| Slurm4DMR mode — stay at preferred size | `SLURM4DMR_QUEUE_POLICY` |
| Application decides when to expand or shrink | `SHOULD_EXPAND` / `SHOULD_SHRINK` |
| Skip reconfiguration this iteration | `SHOULD_STAY` |

---

## ROUND_POLICY

Multiplies the current node count by `stride` at each step. Wraps back to `min_nodes` when `max_nodes` is exceeded.

```c
DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());
```

Example with `MIN=1`, `MAX=8`, `STRIDE=2`: sequence is `1 → 2 → 4 → 8 → 1 → …`

| Parameter | Runtime setter | Env var | Default |
|---|---|---|---|
| Minimum nodes | `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Maximum nodes | `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Stride (multiplier) | `dmr_set_policy_stride(n)` | `DMR_DEFAULT_POLICY_STRIDE` | `2` |

**When to use**: simple cycling tests, early integration, any case where you want to exercise the full expand/shrink path without tuning.

---

## LIST_POLICY

Cycles through a hardcoded sequence `{2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1}`, one step per reconfiguration. No configuration parameters.

```c
DMR_AUTO(dmr_check(LIST_POLICY), save(), (void)NULL, cleanup());
```

**When to use**: benchmarking at specific sizes, stress-testing checkpoint/restart at many different rank counts.

---

## CE_POLICY

Measures accumulated communication efficiency via TALP and adjusts node count to keep it near a target. Requires `DMR_USE_TALP=1` at compile time.

```c
DMR_AUTO(dmr_check(CE_POLICY), save(), (void)NULL, cleanup());
```

| Parameter | Env var | Default |
|---|---|---|
| Minimum nodes | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Maximum nodes | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Target CE | `DMR_TALP_TARGET_CE` | `0.8` |
| Sensitivity | `DMR_TALP_SENSITIVITY` | `15` |

**When to use**: production runs where you want DMR to self-tune based on actual measured communication overhead. Requires DLB/TALP linked at build time.

---

## Slurm4DMR policies

These variants require `DMR_JOBS_CAN_GROW=1` and operate within a Slurm4DMR allocation.

| Policy | Behaviour |
|---|---|
| `SLURM4DMR_ROUND_POLICY` | Same as `ROUND_POLICY`, respects Slurm4DMR allocation |
| `SLURM4DMR_CE_POLICY` | Same as `CE_POLICY`, respects Slurm4DMR allocation |
| `SLURM4DMR_QUEUE_POLICY` | Stays near `pref_nodes`, consulting cluster queue status |

`SLURM4DMR_QUEUE_POLICY` accepts an extra parameter:

```c
dmr_set_policy_pref_nodes(8);  // target size; moves toward it, respects min/max
```

---

## Manual control (`SHOULD_EXPAND` / `SHOULD_SHRINK`)

DMR has no custom policy plugin interface. If built-in policies do not fit, write a
`decide()` function in application code that returns a `DMRSuggestion` and pass it
directly to `dmr_check`:

```c
DMRSuggestion decide(void) { ... }

DMR_AUTO(dmr_check(decide()), save(), (void)NULL, cleanup());
```

**Useful state queries inside `decide()`:**

```c
dmr_get_current_node_count()  // nodes currently in MPI_COMM_WORLD
dmr_get_reconfig_count()      // total reconfigurations since launch
dmr_get_active_expansions()   // expansions currently in flight
dmr_pending_expansion()       // 1 if an expansion is already pending
dmr_cancel_expansion()        // cancel a pending expansion (collective)
```

**Sizing the next operation** (rank 0 only, reset after each reconfiguration):

```c
dmr_set_nodes_next_expand(4);   // add exactly 4 nodes
dmr_set_procs_next_expand(32);  // or specify total processes
dmr_set_ppn_next_expand(8);     // or processes per node
dmr_set_nodes_next_shrink(2);
dmr_set_procs_next_shrink(16);
```

### Pattern: phase-driven scaling

Shrink before communication-heavy phases, expand before compute-heavy ones:

```c
typedef enum { PHASE_COMPUTE, PHASE_COMMUNICATE } Phase;

DMRSuggestion decide(Phase current_phase, int max_nodes, int min_nodes) {
    int nodes = dmr_get_current_node_count();
    if (current_phase == PHASE_COMPUTE && nodes < max_nodes) {
        dmr_set_nodes_next_expand(max_nodes - nodes);
        return SHOULD_EXPAND;
    }
    if (current_phase == PHASE_COMMUNICATE && nodes > min_nodes) {
        dmr_set_nodes_next_shrink(nodes - min_nodes);
        return SHOULD_SHRINK;
    }
    return SHOULD_STAY;
}
```

### Pattern: time-window scaling

Request resources early; halve the target as the deadline approaches; cancel if too
close to the end (used in [loop-qc](https://gitlab.bsc.es/accelcom/releases/dmr/loop-qc)):

```c
DMRSuggestion decide_by_window(int max_nodes, int min_nodes,
                               double elapsed_s, double window_s) {
    double remaining = window_s - elapsed_s;
    if (remaining < 60.0) {
        dmr_cancel_expansion();
        return SHOULD_STAY;
    }
    int target = max_nodes;
    double stage_end = 0.0, fraction = 0.5;
    while (target >= min_nodes * 2) {
        stage_end += window_s * fraction;
        if (elapsed_s <= stage_end) {
            int to_add = target - dmr_get_current_node_count();
            if (to_add > 0) {
                dmr_cancel_expansion();
                dmr_set_nodes_next_expand(to_add);
                return SHOULD_EXPAND;
            }
            return SHOULD_STAY;
        }
        target /= 2;
        fraction /= 2;
    }
    return SHOULD_STAY;
}
```

**When to use manual control**: when the application has domain knowledge unavailable
to built-in policies — phase structure, workload metrics, time constraints, or
convergence state.

---

## Inhibitor — throttle reconfiguration frequency

If `dmr_check` is called every iteration but reconfigurations should be less frequent, use the inhibitor. With inhibitor `N`, `N` out of every `N+1` calls are skipped.

```c
dmr_set_reconf_step_inhibitor(9);  // reconfigure on every 10th call
```

Or via env var before launch: `DMR_DEFAULT_INHIBITOR=9`

**When to use**: when `dmr_check` is inside a tight loop with short iterations and reconfiguring every step would be too disruptive or expensive.

---

## Configuration levels (priority order)

Settings can be applied at three levels. Higher priority overrides lower:

| Priority | Level | How |
|---|---|---|
| 1 (highest) | Runtime | Collective setter functions called before the main loop |
| 2 | Environment | Variables set before launching with `dmr` |
| 3 (lowest) | Compile time | CMake flags at build time |

### Key CMake flags

```bash
cmake -B build \
  -DDMR_PROCS_PER_NODE=112 \
  -DDMR_JOBS_CAN_GROW=1 \
  -DDMR_NODES_IN_EXPAND=2 \
  -DDMR_NODES_IN_SHRINK=2
```

| Flag | Default | Effect |
|---|---|---|
| `DMR_PROCS_PER_NODE` | `1` | Processes per node added in an expand |
| `DMR_JOBS_CAN_SHRINK` | `1` | Enable Slurm job shrinking |
| `DMR_JOBS_CAN_GROW` | `0` | Enable Slurm job growing |
| `DMR_BLOCKING_REQ` | `0` | Block in `dmr_check` until resources are acquired |
| `DMR_NODES_IN_EXPAND` | `1` | Default nodes added per expand |
| `DMR_NODES_IN_SHRINK` | `1` | Default nodes removed per shrink |

### Key environment variables

```bash
DMR_DEFAULT_POLICY_MIN=2 \
DMR_DEFAULT_POLICY_MAX=16 \
DMR_DEFAULT_POLICY_STRIDE=2 \
DMR_DEBUG_LEVEL=1 \
DMR_PRINT_ANALYTICS=1 \
  dmr mpirun -n 2 ./my_app
```

### Expand/shrink sizing setters (rank 0 only, reset after each reconfiguration)

```c
dmr_set_nodes_next_expand(4);    // add 4 nodes on next expand
dmr_set_ppn_next_expand(8);      // with 8 processes per node
dmr_set_procs_next_expand(32);   // or set total processes directly
dmr_set_nodes_next_shrink(2);    // remove 2 nodes on next shrink
dmr_set_procs_next_shrink(16);   // or set total processes to shrink to
```
