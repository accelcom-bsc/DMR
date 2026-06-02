---
sidebar_position: 1
title: Resumen
---

Una **política** le indica a DMR cómo decidir cuándo y cómo reconfigurar. Seleccionas una política pasando un valor `DMRSuggestion` a `dmr_check`.

## Valores de DMRSuggestion

```c
DMRAction action = dmr_check(ROUND_POLICY);
```

| Valor | Descripción |
|-------|-------------|
| `ROUND_POLICY` | Multiplica el número actual de nodos por stride hasta `max_nodes` y luego vuelve a `min_nodes` |
| `LIST_POLICY` | Recorre una lista fija de números de nodos |
| `CE_POLICY` | Apunta a un valor objetivo de eficiencia de comunicación; requiere TALP |
| `SLURM4DMR_ROUND_POLICY` | Igual que `ROUND_POLICY`, adaptada al modo Slurm4DMR |
| `SLURM4DMR_CE_POLICY` | Igual que `CE_POLICY`, adaptada al modo Slurm4DMR |
| `SLURM4DMR_QUEUE_POLICY` | Intenta quedarse en los nodos preferidos y respeta min/max |
| `SHOULD_EXPAND` | Manual: expandir en `DMR_NODES_IN_EXPAND` nodos |
| `SHOULD_SHRINK` | Manual: reducir en `DMR_NODES_IN_SHRINK` nodos |
| `SHOULD_STAY` | Manual: no reconfigurar en esta iteración |

## Configurar políticas

Los parámetros se pueden fijar en tres niveles, por orden de prioridad, del más alto al más bajo:

1. **Tiempo de ejecución**: funciones de configuración llamadas antes del bucle principal, colectivas, todos los ranks deben llamarlas
2. **Variable de entorno**: definirla antes de lanzar con `dmr`
3. **Tiempo de compilación**: bandera de CMake al construir

```c
dmr_set_policy_min_nodes(2);   // DMR no bajará de 2 nodos
dmr_set_policy_max_nodes(16);  // DMR no superará 16 nodos
dmr_set_policy_stride(2);      // multiplicador para ROUND_POLICY
dmr_set_policy_pref_nodes(8);  // número preferido para QUEUE_POLICY
```

```bash
DMR_DEFAULT_POLICY_MIN=2 DMR_DEFAULT_POLICY_MAX=16 dmr mpirun -n 2 ./my_app
```

Los parámetros aceptados por cada política aparecen en [Políticas DMR](dmr-policies).

## Control manual

Usa `SHOULD_EXPAND` o `SHOULD_SHRINK` cuando tu aplicación decida por sí misma el momento de reconfigurar:

```c
if (my_app_needs_more_resources()) {
    dmr_set_nodes_next_expand(4);
    DMR_AUTO(dmr_check(SHOULD_EXPAND), save_data(), (void)NULL, cleanup());
}
```

## Inhibidor

Limita con qué frecuencia DMR intenta una reconfiguración. Si el inhibidor vale `N`, entonces se omiten `N` de cada `N+1` llamadas a `dmr_check`:

```c
dmr_set_reconf_step_inhibitor(9);  // reconfigurar en cada décima llamada
```

O en tiempo de compilación o de ejecución: `DMR_DEFAULT_INHIBITOR=9`.
