---
sidebar_position: 6
title: Migrating from 2.x
---

DMR 3 requests and releases nodes through PMIx, and PRRTE passes the requests on to Slurm. Reconfiguration and policies are reworked into modules. Applications need changes to build against it.

## Rebuild requirements

- DMR 3 requires unreleased PMIx and PRRTE. See [Installation](installation).
- The library soname is `libdmr.so.3`. Applications built against 2.x must be rebuilt.
- Slurm is no longer a build dependency.

## Behavior changes

- The default reconfiguration mechanism is spawn. 2.x defaulted to checkpoint-restart; build DMR with `-DDMR_MECHANISM=cr` to keep it. See [Reconfiguration mechanisms](../user-guide/app-structure#reconfiguration-mechanisms).
- `dmr_init()` fails when DMR's processes do not cover every node of its allocation.
- Reconfigurations no longer oversubscribe nodes. To allow it, launch with `--map-by slot:OVERSUBSCRIBE` and set `DMR_CAP_PROCS_TO_SLOTS=0`.
- `dmr` rejects `--map-by` policies other than `slot`.
- `dmr_intercomm_available()` and `dmr_pending_expansion()` return `bool`.
- Configuring with a removed setting stops CMake when ignoring it would change the build, and names the replacement. Otherwise CMake warns.
- DMR is distributed under the BSD-3-Clause license.

## Removed and replaced

| 2.x | 3.0.0 |
|---|---|
| `dmr_get_active_expansions()` | `dmr_get_active_allocations() - 1` |
| `dmr_set_jobs_next_shrink()` | `dmr_set_allocs_next_shrink()` |
| `dmr_create_custom_analytics_event()`, `dmr_print_analytics_from()`, `dmr_destroy_custom_analytics_event()` | `dmr_print_custom_analytics_event()` |
| `LIST_POLICY`, `ROUND_POLICY`, `CE_POLICY` passed to `dmr_check()` | `dmr_set_policy(dmr_get_policy_*())`, then `dmr_check(USE_POLICY)` |
| `SLURM4DMR_ROUND_POLICY`, `SLURM4DMR_CE_POLICY`, `SLURM4DMR_QUEUE_POLICY` | removed |
| `dmr_set_policy_min_nodes()`, `dmr_set_policy_max_nodes()`, `dmr_set_policy_stride()` | `DMR_DEFAULT_POLICY_MIN`, `_MAX`, `_STRIDE`, read when the policy is created |
| `dmr_set_policy_pref_nodes()`, `DMR_DEFAULT_POLICY_PREF` | removed |
| `DMR_CHECKPOINT_RESTART` | `DMR_MECHANISM=cr` or `spawn` |
| `DMR_JOBS_CAN_SHRINK` | `DMR_CAN_RELEASE_SINGLE_NODES` |
| `DMR_TEST_SLURM_ALLOC_TIMEOUT` | `DMR_TEST_ALLOC_TIMEOUT` |
| `DMR_JOBS_CAN_GROW`, `DMR_SKIP_SSH_CHECK`, `DMR_SSH_CHECK_TIMEOUT`, `DMR_WAIT_FOR_SLURM_S` | removed |
| `SLURM4DMR`, `SLURM4DMR_ROOT`, `SLURM4DMR_BIN_DIR`, `SLURM4DMR_INCLUDE_DIR`, `SLURM4DMR_LIB_DIR`, `SLURM_INCLUDE_DIR`, `SLURM_LIB_DIR`, `CUSTOM_SLURM_BIN_PREFIX` | removed |
| `DMR_EVENT_START_EXPAND_SLURM`, `DMR_EVENT_START_EXPAND_MPI` | `DMR_EVENT_EXPAND_RESOURCES_START`, `DMR_EVENT_EXPAND_RESOURCES_END` |
| `DMR_EVENT_START_SHRINK` | `DMR_EVENT_SHRINK_TRIGGERED` |
| `DMR_EVENT_DATA_REDIST_COMPLETE` | `DMR_EVENT_REDIST_CHILD_END`, `DMR_EVENT_RECONFIG_COMPLETE` |

Policy migration is covered in more detail in [Policies Overview](../user-guide/policies/overview#migrating-from-2x).
