---
sidebar_position: 1
title: What is DMR?
---

DMR is a library that enables your MPI-based application to **change its resource allocation during runtime**. For example, you could launch your application with ten nodes and at some point in the execution scale down to one node, and then later grow to use twenty nodes.

The library handles most of the complex operations behind the scenes, so as a developer, your main focus is on implementing the logic required to redistribute your application's data when resources change.

DMR is developed and maintained by the [Barcelona Supercomputing Center](https://www.bsc.es/).

## Key features

- **Dynamic scaling** – expand or shrink your Slurm node allocation at runtime without restarting.
- **Policy-driven** – choose a built-in reconfiguration policy or implement your own.
- **MPI-native** – integrates directly with Open MPI; no changes to your MPI calls.
- **Minimal API** – three core functions: `dmr_init`, `dmr_check`, and `dmr_finalize`.

## How it works

Your application calls `dmr_check` at a point in the main loop where a reconfiguration is safe. DMR evaluates the active policy and, if a reconfiguration is warranted, coordinates with Slurm to expand or shrink the job. Around a reconfiguration, DMR invokes the data-redistribution callbacks you supply to `DMR_AUTO`. Use `redist_func` to save state before a rank leaves, `restart_func` to restore it when the executable restarts with the new process count, and `finalize_func` to clean up. These callbacks are not tied to the direction of the change; the same ones run whether the job expands or shrinks.

```c
while (should_keep_running()) {
    DMR_AUTO(dmr_check(USE_POLICY), save(), (void)NULL, cleanup());
    do_work();
}
```

See [Reconfiguration Handling](../user-guide/reconfiguration-handling) for what each callback does.

## License

DMR is distributed under the **GNU General Public License, Version 2 (GPLv2)**.

© 2025 Barcelona Supercomputing Center.
