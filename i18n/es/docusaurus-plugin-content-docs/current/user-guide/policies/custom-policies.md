---
sidebar_position: 3
title: Control manual de reconfiguración
---

DMR todavía no tiene una interfaz de plugin para políticas personalizadas. En su lugar, implementas la lógica de reconfiguración directamente en el código de tu aplicación y pasas `SHOULD_EXPAND`, `SHOULD_SHRINK` o `SHOULD_STAY` a `dmr_check`.

## Patrón básico

```c
while (should_keep_running()) {
    DMRSuggestion suggestion = my_decide();
    DMR_AUTO(dmr_check(suggestion), save(), (void)NULL, cleanup());
    do_work();
}
```

`my_decide()` es código normal de aplicación. Lee el estado de DMR, aplica la lógica que encaje con tu carga de trabajo y devuelve una sugerencia.

## Funciones clave para la lógica de decisión

| Función | Descripción |
|----------|-------------|
| `dmr_get_current_node_count()` | Número actual de nodos en `MPI_COMM_WORLD` |
| `dmr_get_reconfig_count()` | Número de reconfiguraciones desde el arranque |
| `dmr_get_active_expansions()` | Número de trabajos de expansión actualmente activos |
| `dmr_pending_expansion()` | `1` si hay una expansión pendiente |
| `dmr_set_nodes_next_expand(n)` | Solicitar `n` nodos en la próxima expansión |
| `dmr_set_nodes_next_shrink(n)` | Eliminar `n` nodos en la próxima reducción |
| `dmr_cancel_expansion()` | Cancelar una expansión pendiente, colectiva |

## Ejemplo: escalado por fases

Un patrón común es escalar según la fase actual del cálculo. Reducir antes de una fase intensiva en comunicación y expandir antes de una intensiva en cómputo:

```c
typedef enum { PHASE_COMPUTE, PHASE_COMMUNICATE } Phase;

DMRSuggestion decide(Phase current_phase, int max_nodes, int min_nodes)
{
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

## Ejemplo: escalado por ventana temporal

En entornos con límite de tiempo quizá quieras pedir recursos pronto y pasar a solicitudes más pequeñas conforme se acerca el plazo. Esta es la estrategia que usa [loop-qc](https://gitlab.bsc.es/accelcom/releases/dmr/loop-qc):

```c
/* Intenta conseguir max_nodes al principio de la ventana. Cuando el tiempo se agota,
   reduce a la mitad el objetivo hasta que ya no merezca la pena expandir.
   Cancela cualquier solicitud pendiente que vaya a ser reemplazada. */
DMRSuggestion decide_by_window(int max_nodes, int min_nodes,
                               double elapsed_s, double window_s)
{
    double remaining = window_s - elapsed_s;

    if (remaining < 60.0) {
        dmr_cancel_expansion();
        return SHOULD_STAY;
    }

    int target = max_nodes;
    double stage_end = 0.0;
    double fraction = 0.5;

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

## Dimensionar la siguiente operación

Sobrescribe el número de nodos o procesos solo para la **siguiente** reconfiguración. Los valores se restablecen después de cada reconfiguración.

```c
dmr_set_nodes_next_expand(int nodes);
dmr_set_procs_next_expand(int procs);  // total de procesos en todos los nodos nuevos
dmr_set_ppn_next_expand(int ppn);      // procesos por nodo
dmr_set_nodes_next_shrink(int nodes);
dmr_set_procs_next_shrink(int procs);
dmr_set_jobs_next_shrink(int jobs);    // elimina N trabajos de expansión completos
```

## Cancelar una expansión pendiente

Si cambian las condiciones y ya no quieres la expansión pendiente:

```c
if (dmr_pending_expansion()) {
    dmr_cancel_expansion();  // colectiva, todos los ranks deben llamarla
}
```

## Usar el inhibidor

Para limitar la frecuencia con la que DMR intenta una reconfiguración, independientemente de la sugerencia:

```c
dmr_set_reconf_step_inhibitor(9);  // 1 de cada 10 llamadas se atiende
DMR_AUTO(dmr_check(SHOULD_EXPAND), save(), (void)NULL, cleanup());
```
