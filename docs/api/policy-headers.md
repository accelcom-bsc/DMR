---
sidebar_position: 2
title: Policy Headers
---

`dmr_test_policies.h` and `dmr_CE_policy.h` are the only headers an application includes by name besides `dmr.h`. They stay out of the barrel because the policies behind them are optional at build time, so what they declare depends on how DMR was compiled.

```c
#include "dmr.h"                 /* the policy interface itself */
#include "dmr_test_policies.h"   /* round and list constructors */
#include "dmr_CE_policy.h"       /* CE constructor */
```

The interface these constructors return, `DMRPolicy` and friends, comes from the barrel and is documented under [Policies](core-api#policies).

## Declarations

| Header | Macro | Constructors |
|--------|-------|--------------|
| `dmr_test_policies.h` | `DMR_TEST_POLICIES` | `DMRPolicy *dmr_get_policy_round(void);`<br/>`DMRPolicy *dmr_get_policy_list(void);` |
| `dmr_CE_policy.h` | `DMR_CE_POLICY` | `DMRPolicy *dmr_get_policy_ce(void);` |

Each header is installed only when its policies are built. It defines its macro with no value, so code can test for it with `#ifdef` after including the header.

## Build flags

| CMake flag | Default | Policies |
|------------|---------|----------|
| `DMR_BUILD_TEST_POLICIES` | `ON` | round, list |
| `DMR_BUILD_CE_POLICY` | `ON` when `DMR_USE_TALP=ON` | ce |

`DMR_BUILD_CE_POLICY=ON` requires `DMR_USE_TALP=ON`. CMake errors out if you ask for one without the other.

## Behaviour common to all three

Every constructor returns a pointer to a **static singleton**, so there is nothing to free and `destroy` is `NULL`. Two consequences:

- Registering the same built-in twice with different parameters does not work. The second call overwrites the first one's state.
- Parameters are re-read from the environment on **every** call, so re-registering is how you re-parameterise a built-in at runtime.

```c
setenv("DMR_DEFAULT_POLICY_MAX", "16", 1);
dmr_set_policy(dmr_get_policy_round());   /* collective, picks up the new value */
```

What each policy decides, and which environment variables it reads, is in [Built-in Policies](../user-guide/policies/dmr-policies).
