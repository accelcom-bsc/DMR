---
title: Analytics
description: DMR built-in analytics and how to use them.
---

DMR collects lightweight analytics at each reconfiguration and can print them at runtime.

## Enabling analytics

Set the environment variable before launching your job:

```bash
export DMR_PRINT_ANALYTICS=1
mpirun -n 4 ./my_app
```

Or override at compile time:

```bash
cmake -B build -DDMR_PRINT_ANALYTICS=1
```

## What is reported

At each reconfiguration DMR prints a summary line containing:

| Field | Description |
|-------|-------------|
| Nodes | Number of nodes in the new configuration |
| Processes | Number of MPI processes in the new configuration |
| Time since last reconfig | Wall-clock seconds since the previous reconfiguration (or since `dmr_init`) |

Example output:

```
[DMR analytics] nodes=8 procs=8 time_since_last_reconfig=12.34s
```

## Using analytics in policies

The `DMRPolicyContext` struct exposes the reconfiguration count (`reconfig_count`) which policies can use to implement time- or iteration-based strategies. See [Policy Context Reference](/en/policies/policy-context-reference/) for the full field list.

## TALP-based analytics

When compiled with `DMR_USE_TALP=1`, the CE policy (`dmr_policy_ce`) additionally reads TALP metrics — including communication efficiency — to make scaling decisions. These metrics are collected via DLB's `CollectPOPMetrics` MPI collective inside the policy's `populate` callback.
