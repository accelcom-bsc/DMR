---
title: Migration from Legacy API
description: How to migrate from the deprecated policy enum API to the new policy object API.
---

The original DMR API selected a policy by passing a named enum value to `dmr_check` and configured its parameters via dedicated setters. This API is still supported but produces **compiler deprecation warnings**. Migrate to the new API to silence them.

## Migration table

| Old code | New equivalent |
|----------|----------------|
| `dmr_check(ROUND_POLICY)` | `dmr_set_policy(dmr_policy_round()); dmr_check(USE_POLICY);` |
| `dmr_check(CE_POLICY)` | `dmr_set_policy(dmr_policy_ce()); dmr_check(USE_POLICY);` |
| `dmr_check(LIST_POLICY)` | `dmr_set_policy(dmr_policy_list()); dmr_check(USE_POLICY);` |
| `dmr_check(SLURM4DMR_ROUND_POLICY)` | `dmr_set_policy(dmr_policy_round()); dmr_check(USE_POLICY);` |
| `dmr_check(SLURM4DMR_CE_POLICY)` | `dmr_set_policy(dmr_policy_ce()); dmr_check(USE_POLICY);` |
| `dmr_check(SLURM4DMR_QUEUE_POLICY)` | `dmr_set_policy(dmr_policy_round()); dmr_check(USE_POLICY);` |
| `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN=n` env var |
| `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX=n` env var |
| `dmr_set_policy_stride(n)` | `DMR_DEFAULT_POLICY_STRIDE=n` env var |
| `dmr_set_policy_pref_nodes(n)` | `DMR_DEFAULT_POLICY_PREF=n` env var |

## Before migration

```c
dmr_set_policy_min_nodes(2);
dmr_set_policy_max_nodes(16);
dmr_set_policy_stride(2);

while (should_keep_running()) {
    DMR_AUTO(dmr_check(ROUND_POLICY), redistribute(), redistribute(), cleanup());
    do_work();
}
```

## After migration

```c
// Set via environment variables or use defaults:
// DMR_DEFAULT_POLICY_MIN=2
// DMR_DEFAULT_POLICY_MAX=16
// DMR_DEFAULT_POLICY_STRIDE=2

dmr_set_policy(dmr_policy_round());

while (should_keep_running()) {
    DMR_AUTO(dmr_check(USE_POLICY), redistribute(), redistribute(), cleanup());
    do_work();
}
```

## Silencing warnings temporarily

If you cannot migrate immediately, suppress the warnings with:

```bash
mpicc -Wno-deprecated-declarations -o my_app my_app.c -ldmr
```
