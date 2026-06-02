---
sidebar_position: 2
title: Referencia de políticas
---

Pasa un valor `DMRSuggestion` a `dmr_check`:

```c
#include "dmr.h"

DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());
```

Consulta [DMRSuggestion](core-api#dmrsuggestion) para ver todos los valores disponibles.

## Límites de política, colectivos

```c
DMRStatus dmr_set_policy_min_nodes(int nodes);
DMRStatus dmr_set_policy_max_nodes(int nodes);
DMRStatus dmr_set_policy_stride(int multiplier);
DMRStatus dmr_set_policy_pref_nodes(int nodes);
DMRStatus dmr_set_reconf_step_inhibitor(int steps);
```

## Tamaño de expansión y reducción, solo rank 0

Los valores se aplican solo a la próxima reconfiguración y se restablecen después.

```c
DMRStatus dmr_set_nodes_next_expand(int nodes);
DMRStatus dmr_set_procs_next_expand(int procs);
DMRStatus dmr_set_ppn_next_expand(int ppn);
DMRStatus dmr_set_nodes_next_shrink(int nodes);
DMRStatus dmr_set_procs_next_shrink(int procs);
DMRStatus dmr_set_jobs_next_shrink(int jobs);
```

## Control de expansión, colectivo

```c
DMRStatus dmr_cancel_expansion(void);
```

## Consultas de estado

```c
int dmr_get_current_node_count(void);
int dmr_get_reconfig_count(void);
int dmr_get_active_expansions(void);
int dmr_pending_expansion(void);
int dmr_get_nodes_next_expand(void);
int dmr_get_procs_next_expand(void);
int dmr_get_nodes_next_shrink(void);
int dmr_get_procs_next_shrink(void);
```

Para patrones de uso, consulta [Resumen de políticas](../user-guide/policies/overview) y [Políticas DMR](../user-guide/policies/dmr-policies).
