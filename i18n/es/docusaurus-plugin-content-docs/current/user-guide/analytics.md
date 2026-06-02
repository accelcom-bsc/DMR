---
sidebar_position: 5
title: Analíticas
---

DMR puede registrar líneas de analíticas estructuradas en cada evento de reconfiguración. Estos registros se pueden visualizar con el notebook de Jupyter incluido en `viz/`.

## Habilitar analíticas

Antes de lanzar tu aplicación:

```bash
export DMR_PRINT_ANALYTICS=1
dmr mpirun ...
```

O habilítalo permanentemente en tiempo de compilación:

```bash
cmake -B build -DDMR_PRINT_ANALYTICS=1
```

## Formato del registro

Cada línea de analíticas tiene el siguiente formato CSV:

```
[DMR ANALYTICS],<timestamp>,<function>,<event>,<world_size>,<node_count>,<reconfig_time>,<ce>,<pending_nodes>
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `timestamp` | float | Marca temporal Unix en la que se registró el evento |
| `function` | string | Función de DMR que emitió el evento |
| `event` | string | Identificador del evento, ver abajo |
| `world_size` | int | Número de procesos MPI en `MPI_COMM_WORLD` |
| `node_count` | int | Número de nodos en `MPI_COMM_WORLD` |
| `reconfig_time` | float | Segundos necesarios para completar la última reconfiguración, o `-1` si no aplica |
| `ce` | float | Última eficiencia de comunicación acumulada por TALP, o `-1` si no está disponible |
| `pending_nodes` | int | Nodos solicitados a Slurm pero aún no asignados |

Ejemplo de línea:

```
[DMR ANALYTICS],1748000123.45,dmr_check,DMR_EVENT_CHECK_CALLED,8,8,-1.00,-1.000000,0
```

## Eventos

| Evento | Cuándo se emite |
|-------|-------------|
| `DMR_EVENT_NONE` | Todavía no hay evento |
| `DMR_EVENT_INIT_COMPLETE` | `dmr_init` ha terminado |
| `DMR_EVENT_CHECK_CALLED` | Se ha llamado a `dmr_check` |
| `DMR_EVENT_STAY_CURRENT` | La política decidió quedarse en el tamaño actual |
| `DMR_EVENT_START_EXPAND_SLURM` | Se han solicitado recursos a Slurm |
| `DMR_EVENT_START_EXPAND_MPI` | Ha comenzado el proceso de expansión MPI |
| `DMR_EVENT_START_SHRINK` | Se ha activado la reducción |
| `DMR_EVENT_DATA_REDIST_COMPLETE` | La redistribución de datos ha terminado |
| `DMR_EVENT_TALP_CHECK_CE_ACC` | Se ha realizado la comprobación de eficiencia de comunicación TALP |
| `DMR_EVENT_LAST_FINALIZE` | Se ha llamado a `dmr_finalize` fuera de una reconfiguración |

## Eventos analíticos personalizados

Puedes emitir tus propias líneas de analíticas en cualquier momento usando `dmr_create_custom_analytics_event`. Esto crea una instantánea del estado actual del runtime de DMR etiquetada con tu cadena de evento, que luego se imprime con el mismo formato que los eventos predefinidos de DMR y puede ser leída por el notebook.

```c
DMRAnalytics *event;

// Crear una instantánea etiquetada con el nombre de tu evento
dmr_create_custom_analytics_event("MY_APP_PHASE_START", &event);

// Imprimirla, solo emite una línea si DMR_PRINT_ANALYTICS=1
dmr_print_analytics_from(event);

// Liberarla cuando ya no haga falta
dmr_destroy_custom_analytics_event(event);
```

La cadena del evento no debe entrar en conflicto con las constantes integradas `DMR_EVENT_*`.

## Visualizar con el notebook de Jupyter

El notebook `viz/dmr_analytics_visualizer.ipynb` lee los registros de analíticas y genera gráficos. Filtra automáticamente las líneas `[DMR ANALYTICS]`, así que puedes pasarle la salida cruda de la aplicación sin preprocesado.

### Gráficos disponibles

| Gráfico | Requiere |
|-------|----------|
| Recuento de nodos/procesos a lo largo del tiempo | `DMR_PRINT_ANALYTICS=1` |
| Recuento de nodos/procesos a lo largo de las iteraciones | `DMR_PRINT_ANALYTICS=1`, aplicación iterativa con `dmr_check` en cada iteración |
| Recuento de nodos + nodos pendientes a lo largo del tiempo o de las iteraciones | `DMR_PRINT_ANALYTICS=1` |
| Recuento de nodos + eficiencia de comunicación a lo largo del tiempo o de las iteraciones | `DMR_PRINT_ANALYTICS=1` + `DMR_USE_TALP=1` |

### Configuración: con Nix, recomendado

La carpeta `viz/` tiene un `flake.nix` con todas las dependencias de Python, pandas, matplotlib, numpy y Jupyter.

**Lanzamiento de una sola vez:**

```bash
cd viz/
nix run
```

Abre automáticamente el notebook de Jupyter en `http://127.0.0.1:8888`.

**Shell de desarrollo, para tener más control:**

```bash
cd viz/
nix develop
jupyter notebook --ip=127.0.0.1
# o: jupyter lab --ip=127.0.0.1
```

:::caution
Usa explícitamente `--ip=127.0.0.1`. El valor por defecto `localhost` puede fallar en algunos navegadores.
:::

### Configuración manual

Instala las dependencias con pip:

```bash
pip install jupyter notebook pandas matplotlib numpy
```

Después lanza:

```bash
cd viz/
jupyter notebook --ip=127.0.0.1
```

### Uso

1. Coloca el archivo de log en la carpeta `viz/`, o proporciona su ruta absoluta.
2. Abre `dmr_analytics_visualizer.ipynb`.
3. Edita la primera celda para apuntar a tu archivo de log:

```python
dmr_log_files = [ "my_run.out" ]
```

4. Ejecuta todas las celdas. El notebook admite varios archivos de log para compararlos.
