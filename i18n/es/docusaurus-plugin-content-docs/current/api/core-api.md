---
sidebar_position: 1
title: Referencia de API
---

```c
#include "dmr.h"
```

## Tipos

### DMRSuggestion

Se pasa a `dmr_check` para seleccionar la política de reconfiguración.

| Valor | Descripción |
|-------|-------------|
| `ROUND_POLICY` | Multiplica el número actual de nodos por el stride hasta `max_nodes` y luego vuelve a `min_nodes` |
| `LIST_POLICY` | Itera sobre una lista fija de números de nodos |
| `CE_POLICY` | Apunta a un valor objetivo de eficiencia de comunicación; requiere TALP |
| `SLURM4DMR_ROUND_POLICY` | Variante de `ROUND_POLICY` para Slurm4DMR |
| `SLURM4DMR_CE_POLICY` | Variante de `CE_POLICY` para Slurm4DMR |
| `SLURM4DMR_QUEUE_POLICY` | Mantiene los nodos preferidos respetando mínimo y máximo |
| `SHOULD_EXPAND` | Expandir en `DMR_NODES_IN_EXPAND` nodos |
| `SHOULD_SHRINK` | Reducir en `DMR_NODES_IN_SHRINK` nodos |
| `SHOULD_STAY` | No reconfigurar en esta iteración |

### DMRAction

Devuelto por `dmr_init`, `dmr_check`, `dmr_reconfigure` y `dmr_finalize`.

| Valor | Significado |
|-------|-------------|
| `DMR_NO_ACTION` | No se requiere ninguna acción |
| `DMR_RECONF` | Llamar a `dmr_reconfigure()` |
| `DMR_RESTART_RECONF` | Restaurar checkpoint o datos y luego llamar a `dmr_reconfigure()` |
| `DMR_REDIST_FINALIZE` | Guardar o enviar datos y luego llamar a `dmr_finalize()`; el rank termina |
| `DMR_FINALIZE` | Llamar a `dmr_finalize()`; el rank termina |
| `DMR_CLEANUP` | Limpieza opcional, el rank continúa |
| `DMR_ERROR` | Se ha producido un error |

### DMRStatus

Devuelto por las funciones de configuración y las llamadas de analíticas.

| Valor | Significado |
|-------|-------------|
| `DMR_SUCCESS` | Éxito |
| `DMR_ERROR_STATUS` | Fallo no especificado |
| `DMR_ERROR_UNINITIALIZED` | La biblioteca no está inicializada |
| `DMR_ERROR_NOT_ROOT` | Debe llamarse desde el rank 0 |
| `DMR_ERROR_ARG_NULL` | Un argumento obligatorio era NULL |
| `DMR_ERROR_BAD_ARGS` | Un argumento fue rechazado |
| `DMR_ERROR_UNSUPPORTED` | No compatible con el estado o la compilación actuales |
| `DMR_ERROR_OUT_OF_MEM` | Memoria insuficiente |

### DMRAnalytics

```c
typedef struct {
    double      event_time;               // Marca temporal Unix del evento
    const char *function;                 // Función DMR que emitió el evento
    const char *event;                    // Identificador del evento, constante DMR_EVENT_*
    int         world_size;               // Procesos MPI en el MPI_COMM_WORLD actual
    int         node_count;               // Nodos en el MPI_COMM_WORLD actual
    double      reconfiguration_time;     // Segundos de la última reconfiguración, -1 si no aplica
    double      communication_efficiency; // Última eficiencia de comunicación TALP, -1 si no aplica
    int         pending_nodes;            // Nodos solicitados pero aún no asignados
} DMRAnalytics;
```

## Variable global

```c
extern MPI_Comm DMR_INTERCOMM;
```

Intercomunicador que conecta los procesos salientes y entrantes durante una reconfiguración. Solo es válido cuando `dmr_intercomm_available()` devuelve `1` y `DMR_CHECKPOINT_RESTART=0`.

## Funciones principales

### dmr_init

```c
DMRAction dmr_init(int argc, char *argv[]);
```

Inicializa DMR. Llamar inmediatamente después de `MPI_Init`. **Colectiva.**

Devuelve `DMR_NO_ACTION` en el primer arranque, o `DMR_RESTART_RECONF` cuando el ejecutable se reinicia tras una reconfiguración.

### dmr_check

```c
DMRAction dmr_check(DMRSuggestion suggestion);
```

Evalúa la política y gestiona cualquier reconfiguración pendiente. Llamar en el bucle principal. **Colectiva.**

### dmr_reconfigure

```c
DMRAction dmr_reconfigure(void);
```

Ejecuta la reconfiguración. Llamar solo cuando `dmr_check` devuelve `DMR_RECONF`. `DMR_AUTO` lo gestiona automáticamente.

### dmr_finalize

```c
DMRAction dmr_finalize(void);
```

Finaliza DMR. Llamar antes de `MPI_Finalize`. No es colectiva; una vez que un rank la llama, no puede realizar más llamadas a DMR desde ese rank.

## Configuración de política (colectiva)

```c
DMRStatus dmr_set_policy_min_nodes(int nodes);
DMRStatus dmr_set_policy_max_nodes(int nodes);
DMRStatus dmr_set_policy_stride(int multiplier);
DMRStatus dmr_set_policy_pref_nodes(int nodes);
DMRStatus dmr_set_reconf_step_inhibitor(int steps);
```

## Ajuste de tamaño de operaciones (solo rank 0)

Los valores se aplican únicamente a la siguiente reconfiguración y se restablecen después.

```c
DMRStatus dmr_set_nodes_next_expand(int nodes);
DMRStatus dmr_set_procs_next_expand(int procs);
DMRStatus dmr_set_ppn_next_expand(int ppn);
DMRStatus dmr_set_nodes_next_shrink(int nodes);
DMRStatus dmr_set_procs_next_shrink(int procs);
DMRStatus dmr_set_jobs_next_shrink(int jobs);
```

## Consultas de estado

```c
int dmr_get_current_node_count(void);
int dmr_get_reconfig_count(void);
int dmr_get_active_expansions(void);
int dmr_pending_expansion(void);
int dmr_intercomm_available(void);
int dmr_get_nodes_next_expand(void);
int dmr_get_procs_next_expand(void);
int dmr_get_nodes_next_shrink(void);
int dmr_get_procs_next_shrink(void);
DMRAction dmr_get_last_action(void);
```

## Control de expansión (colectiva)

```c
DMRStatus dmr_cancel_expansion(void);
```

Cancela un trabajo de expansión pendiente. Solo es válida cuando `dmr_pending_expansion()` devuelve `1`.

## Analíticas

```c
DMRStatus dmr_get_analytics(DMRAnalytics *analytics);
DMRStatus dmr_create_custom_analytics_event(char const *event, DMRAnalytics **analytics_out);
DMRStatus dmr_destroy_custom_analytics_event(DMRAnalytics *analytics);
DMRStatus dmr_print_analytics_from(DMRAnalytics const *analytics_in);
```

## Macro DMR_AUTO

```c
DMR_AUTO(the_action, redist_func, restart_func, finalize_func)
```

Dirige la ejecución al callback adecuado según `the_action`. Consulta [Gestión de reconfiguraciones](../user-guide/reconfiguration-handling) para la documentación completa.

## Constantes de eventos de analíticas

| Constante | Cuándo se emite |
|-----------|-----------------|
| `DMR_EVENT_NONE` | Ningún evento todavía |
| `DMR_EVENT_INIT_COMPLETE` | `dmr_init` ha completado |
| `DMR_EVENT_CHECK_CALLED` | Se ha llamado a `dmr_check` |
| `DMR_EVENT_STAY_CURRENT` | La política decidió no reconfigurar |
| `DMR_EVENT_START_EXPAND_SLURM` | Se han solicitado recursos a Slurm |
| `DMR_EVENT_START_EXPAND_MPI` | Ha comenzado la expansión MPI |
| `DMR_EVENT_START_SHRINK` | Se ha iniciado una reducción |
| `DMR_EVENT_DATA_REDIST_COMPLETE` | La redistribución de datos ha finalizado |
| `DMR_EVENT_TALP_CHECK_CE_ACC` | Se ha realizado la comprobación de eficiencia de comunicación TALP |
| `DMR_EVENT_LAST_FINALIZE` | `dmr_finalize` llamada fuera de una reconfiguración |
