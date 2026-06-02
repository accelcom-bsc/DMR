---
sidebar_position: 2
title: Políticas DMR
---

DMR incluye varias políticas que cubren las estrategias de escalado más habituales. Seleccionas una pasando el valor `DMRSuggestion` correspondiente a `dmr_check`. Todas las políticas respetan los límites `DMR_DEFAULT_POLICY_MIN` y `DMR_DEFAULT_POLICY_MAX`, que puedes definir con variables de entorno o con las funciones de configuración en tiempo de ejecución.

## ROUND_POLICY

Multiplica el número actual de nodos por `stride` en cada paso de reconfiguración. Cuando el resultado excedería `max_nodes`, vuelve a `min_nodes`.

```c
DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());
```

Con `MIN=1`, `MAX=8`, `STRIDE=2`, la secuencia es 1 → 2 → 4 → 8 → 1 -> ...

| Parámetro | Función de configuración | Variable de entorno | Bandera de CMake | Predeterminado |
|-----------|---------------|---------|------------|---------|
| Nodos mínimos | `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN` | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Nodos máximos | `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX` | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Stride, multiplicador | `dmr_set_policy_stride(n)` | `DMR_DEFAULT_POLICY_STRIDE` | `DMR_DEFAULT_POLICY_STRIDE` | `2` |

## LIST_POLICY

Recorre una secuencia fija de números de nodos `{2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1}`, avanzando un paso por reconfiguración. Está diseñada para pruebas y pruebas comparativas.

```c
DMR_AUTO(dmr_check(LIST_POLICY), save(), (void)NULL, cleanup());
```

Sin parámetros de configuración.

## CE_POLICY

Mide la eficiencia de comunicación acumulada mediante TALP y ajusta el número de nodos para mantenerlo cerca de un objetivo. Requiere `DMR_USE_TALP=1` en tiempo de compilación.

```c
DMR_AUTO(dmr_check(CE_POLICY), save(), (void)NULL, cleanup());
```

| Parámetro | Función de configuración | Variable de entorno | Bandera de CMake | Predeterminado |
|-----------|---------------|---------|------------|---------|
| Nodos mínimos | `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN` | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Nodos máximos | `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX` | `DMR_DEFAULT_POLICY_MAX` | `1` |
| CE objetivo | — | `DMR_TALP_TARGET_CE` | `DMR_TALP_TARGET_CE` | `0.8` |
| Sensibilidad | — | `DMR_TALP_SENSITIVITY` | `DMR_TALP_SENSITIVITY` | `15` |

## Políticas Slurm4DMR

Estas variantes están pensadas para el modo Slurm4DMR y requieren `DMR_JOBS_CAN_GROW=1`.

### SLURM4DMR_ROUND_POLICY

Misma lógica de multiplicador que `ROUND_POLICY`, pero operando dentro de una asignación Slurm4DMR.

| Parámetro | Función de configuración | Variable de entorno | Bandera de CMake | Predeterminado |
|-----------|---------------|---------|------------|---------|
| Nodos mínimos | `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN` | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Nodos máximos | `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX` | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Stride | `dmr_set_policy_stride(n)` | `DMR_DEFAULT_POLICY_STRIDE` | `DMR_DEFAULT_POLICY_STRIDE` | `2` |

### SLURM4DMR_CE_POLICY

La misma lógica de eficiencia de comunicación que `CE_POLICY`, pero para Slurm4DMR. Usa los mismos parámetros que CE_POLICY más arriba.

### SLURM4DMR_QUEUE_POLICY

Apunta a un número de nodos preferido respetando los mínimos y máximos, y consulta el estado del clúster desde Slurm4DMR.

```c
DMR_AUTO(dmr_check(SLURM4DMR_QUEUE_POLICY), save(), (void)NULL, cleanup());
```

| Parámetro | Función de configuración | Variable de entorno | Bandera de CMake | Predeterminado |
|-----------|---------------|---------|------------|---------|
| Nodos mínimos | `dmr_set_policy_min_nodes(n)` | `DMR_DEFAULT_POLICY_MIN` | `DMR_DEFAULT_POLICY_MIN` | `1` |
| Nodos máximos | `dmr_set_policy_max_nodes(n)` | `DMR_DEFAULT_POLICY_MAX` | `DMR_DEFAULT_POLICY_MAX` | `1` |
| Nodos preferidos | `dmr_set_policy_pref_nodes(n)` | `DMR_DEFAULT_POLICY_PREF` | `DMR_DEFAULT_POLICY_PREF` | `1` |
| Stride | `dmr_set_policy_stride(n)` | `DMR_DEFAULT_POLICY_STRIDE` | `DMR_DEFAULT_POLICY_STRIDE` | `2` |
