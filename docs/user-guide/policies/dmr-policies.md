---
sidebar_position: 2
title: Built-in Policies
---

DMR ships three built-in policies. Each one is obtained from a constructor that returns a ready-to-use `DMRPolicy *`, which you hand to `dmr_set_policy`.

| Constructor | Header | Description |
|-------------|--------|-------------|
| `dmr_get_policy_round()` | `dmr_test_policies.h` | Multiplies the current node count by a stride, wrapping back to the minimum |
| `dmr_get_policy_list()` | `dmr_test_policies.h` | Cycles through a fixed list of node counts |
| `dmr_get_policy_ce()` | `dmr_CE_policy.h` | Targets a communication efficiency value, using TALP metrics |

`dmr.h` does not pull these headers in: include the one you need explicitly. Each policy is also compiled in only if its CMake flag is on, `DMR_BUILD_TEST_POLICIES` for round and list, `DMR_BUILD_CE_POLICY` for CE. Both are on by default, the second one only in TALP builds. The declarations, guards, and flags are in [Policy Headers](../../api/policy-headers).

## Round policy

Multiplies the current node count by `stride`. When the result would exceed the maximum, it wraps back to the minimum.

```c
#include "dmr.h"
#include "dmr_test_policies.h"

dmr_set_policy(dmr_get_policy_round());

while (should_keep_running()) {
    DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup());
    do_work();
}
```

With `MIN=1`, `MAX=8`, `STRIDE=2` the sequence is 1 → 2 → 4 → 8 → 1 → …

| Parameter | Environment variable | Default |
|-----------|----------------------|---------|
| Minimum nodes | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Maximum nodes | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Stride (multiplier) | `DMR_DEFAULT_POLICY_STRIDE` | `2` |

The defaults are also the compile-time fallbacks, settable as CMake variables of the same name.

## List policy

Cycles through the hardcoded sequence `{2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1}`, indexed by `dmr_get_reconfig_count()`. Intended for testing and benchmarking.

```c
#include "dmr.h"
#include "dmr_test_policies.h"

dmr_set_policy(dmr_get_policy_list());
```

No parameters, and no minimum or maximum: the list itself is the bound.

## CE policy

Reads the accumulated communication efficiency from TALP in `populate`, then in `run` adjusts the node count to push that efficiency towards a target:

```
change      = round((target_ce - current_ce) * -sensitivity)
target_nodes = clamp(current_nodes + change, min_nodes, max_nodes)
```

Efficiency below the target means the job is spending too much time in communication, so `change` is negative and the policy shrinks; efficiency above the target lets it grow. If TALP reports no usable metrics for this iteration, the policy stays.

```c
#include "dmr.h"
#include "dmr_CE_policy.h"

dmr_set_policy(dmr_get_policy_ce());
```

| Parameter | Environment variable | Default |
|-----------|----------------------|---------|
| Minimum nodes | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Maximum nodes | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Target CE | `DMR_TALP_TARGET_CE` | `0.8` |
| Sensitivity | `DMR_TALP_SENSITIVITY` | `15` |

Requires a build with `DMR_USE_TALP=ON` and the job launched so that TALP is collecting metrics; see [Configuration](../configuration).

## Changing parameters at runtime

Every constructor reads its environment variables each time it is called, and returns the same static object, so re-registering the policy is how you re-parameterise it:

```c
setenv("DMR_DEFAULT_POLICY_MAX", "16", 1);
dmr_set_policy(dmr_get_policy_round());   /* collective: all ranks */
```

All ranks must call `dmr_set_policy`, and they must see the same values, otherwise ranks will disagree on the suggestion. For anything more elaborate, write a [custom policy](custom-policies).
