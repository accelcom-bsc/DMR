---
sidebar_position: 4
title: Configuración
---

DMR se puede configurar en tiempo de compilación, con CMake, en el momento del lanzamiento, con variables de entorno, y en tiempo de ejecución, con funciones setter. Las variables de entorno anulan los valores por defecto de CMake, y los setters en tiempo de ejecución anulan las variables de entorno.

## Opciones de CMake

```bash
cmake -B build \
  -DCMAKE_INSTALL_PREFIX=/path/to/install \
  -DDMR_PROCS_PER_NODE=112 \
  -DDMR_USE_TALP=1 \
  -DDLB_ROOT=$DLB_PREFIX
```

| Opción | Predeterminado | Descripción |
|--------|---------|-------------|
| `CMAKE_INSTALL_PREFIX` | valor del sistema | Directorio de instalación para los encabezados y `libdmr` |
| `DMR_PROCS_PER_NODE` | `1` | Procesos lanzados por nodo añadido en una expansión |
| `DMR_USE_TALP` | `0` | Compilar con DLB/TALP, habilita las políticas CE |
| `DMR_CHECKPOINT_RESTART` | `1` | Usar checkpoint-restart para las reconfiguraciones. Ponlo a `0` para usar el intercomunicador (`DMR_INTERCOMM`) en su lugar |
| `DMR_JOBS_CAN_SHRINK` | `1` | Habilitar la reducción de trabajos Slurm |
| `DMR_JOBS_CAN_GROW` | `0` | Habilitar el crecimiento de trabajos Slurm, requiere `DMR_JOBS_CAN_SHRINK=1` |
| `DMR_BLOCKING_REQ` | `0` | Bloquear en `dmr_check` hasta obtener recursos. Útil con Slurm4DMR |
| `DMR_NODES_IN_EXPAND` | `1` | Nodos por defecto que se añaden en cada paso de expansión |
| `DMR_NODES_IN_SHRINK` | `1` | Nodos por defecto que se eliminan en cada paso de reducción |
| `DMR_SKIP_SSH_CHECK` | `0` | Saltar la comprobación SSH en los nuevos nodos antes de expandir |
| `DMR_SSH_CHECK_TIMEOUT` | `20` | Segundos de espera para la comprobación SSH antes de continuar |

## Variables de entorno en tiempo de ejecución

### Depuración y analíticas

| Variable | Predeterminado | Descripción |
|----------|-------------|-------------|
| `DMR_DEBUG_LEVEL` | `0` | `0` = desactivado, `1` = solo rank 0, `2` = todos los ranks |
| `DMR_PRINT_ANALYTICS` | `0` | Imprimir una línea de analíticas en cada reconfiguración cuando vale `1` |

### Tamaño de expansión y reducción

| Variable | Predeterminado | Descripción |
|----------|-------------|-------------|
| `DMR_NODES_IN_EXPAND` | `1` | Nodos por defecto por cada expansión |
| `DMR_NODES_IN_SHRINK` | `1` | Nodos por defecto por cada reducción |
| `DMR_PROCS_PER_NODE` | *(de CMake)* | Procesos por nodo en una expansión |

### Política

| Variable | Predeterminado | Descripción |
|----------|-------------|-------------|
| `DMR_DEFAULT_POLICY_MIN` | `1` | Número mínimo de nodos |
| `DMR_DEFAULT_POLICY_MAX` | `1` | Número máximo de nodos |
| `DMR_DEFAULT_POLICY_STRIDE` | `2` | Multiplicador para `ROUND_POLICY` |
| `DMR_DEFAULT_POLICY_PREF` | `1` | Nodos preferidos para `SLURM4DMR_QUEUE_POLICY` |
| `DMR_DEFAULT_INHIBITOR` | `0` | Saltar N llamadas a `dmr_check` de cada N+1 |
| `DMR_TALP_TARGET_CE` | `0.8` | Eficiencia de comunicación objetivo para las políticas CE |
| `DMR_TALP_SENSITIVITY` | `15` | Sensibilidad del ajuste para las políticas CE |

## Funciones de configuración en tiempo de ejecución

Todos los setters son **colectivos**: todos los ranks deben llamarlos.

```c
dmr_set_policy_min_nodes(2);
dmr_set_policy_max_nodes(16);
dmr_set_policy_stride(2);
dmr_set_policy_pref_nodes(8);
dmr_set_reconf_step_inhibitor(4);
```

Ajuste de tamaño de operaciones (solo rank 0). Los valores se restablecen tras cada reconfiguración:

```c
dmr_set_nodes_next_expand(4);
dmr_set_ppn_next_expand(8);
dmr_set_procs_next_expand(32);
dmr_set_nodes_next_shrink(2);
dmr_set_procs_next_shrink(16);
```
