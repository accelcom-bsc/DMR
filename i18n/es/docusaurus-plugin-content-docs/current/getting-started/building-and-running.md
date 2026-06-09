---
sidebar_position: 4
title: Compilar y ejecutar tu aplicación
---

Una vez que DMR está disponible en tu sistema, compilas tu aplicación contra él y la lanzas a través del wrapper de DMR. **La forma de compilar y de lanzar depende del [modo de operación](modes-of-operation)** que utilices.

## Requisito previo: DMR instalado

- **MareNostrum 5:** `module load dmr` proporciona la biblioteca, los encabezados y todas las dependencias.
- **Otros sistemas:** compila DMR desde el código fuente, consulta [Instalación](installation).

En cualquier caso acabas con los directorios `include` y `lib` de DMR disponibles (a los que nos referimos abajo como `$DMR_PATH`).

## Compilar tu aplicación

Incluye el encabezado y enlaza con `libdmr`:

```c
#include "dmr.h"
```

```bash
mpicc -o my_app my_app.c -I$DMR_PATH/include -L$DMR_PATH/lib -ldmr
```

Si el módulo de DMR (o tu entorno) ya expone las rutas de los encabezados y la biblioteca, basta con `-ldmr`:

```bash
mpicc -o my_app my_app.c -ldmr
```

Con CMake:

```cmake
find_package(DMR REQUIRED)
target_link_libraries(my_app PRIVATE DMR::dmr)
```

### Seleccionar el modo en tiempo de compilación

El **mismo código fuente** se compila para cualquiera de los dos modos; un flag de compilación selecciona qué backend de gestor de recursos usa el binario:

| Modo | Flag de compilación |
| --- | --- |
| DMR@Jobs (por defecto) | ninguno |
| Slurm4DMR | `-DUSE_SLURM4DMR` |

```bash
# DMR@Jobs
mpicc -o my_app my_app.c -ldmr

# Slurm4DMR
mpicc -o my_app my_app.c -ldmr -DUSE_SLURM4DMR
```

## Ejecutar tu aplicación

DMR debe ejecutarse dentro de una **asignación de Slurm**, lanzada a través del wrapper `dmr` (que envuelve a `mpirun`). La forma de hacerlo difiere según el modo.

### DMR@Jobs

Envía un trabajo por lotes normal que invoque el wrapper. DMR solicita añadir o quitar nodos al Slurm del sistema a medida que la aplicación se reconfigura.

```bash
#!/bin/bash
#SBATCH --time=00:10:00
#SBATCH --exclusive
#SBATCH -N 1

export DMR_PROCS_PER_NODE=1

NODELIST_WITH_COUNTS=$(scontrol show hostnames "$SLURM_JOB_NODELIST" \
  | awk -v n="$DMR_PROCS_PER_NODE" '{print $1 ":" n}' \
  | paste -sd,)

dmr mpirun --host $NODELIST_WITH_COUNTS ./my_app
```

```bash
sbatch submit.sh
```

### Slurm4DMR

Slurm4DMR ejecuta una **instancia anidada de Slurm** dentro de una asignación fija, que reasigna nodos internamente a medida que la aplicación se reconfigura. Compila con `-DUSE_SLURM4DMR` y usa un script de lanzamiento que despliega el Slurm anidado y envía tu trabajo a él (la invocación del wrapper sigue el mismo patrón `dmr mpirun`, pero se ejecuta contra el Slurm interno).

:::note
Por ahora Slurm4DMR solo está pensado para ejecutarse en **MareNostrum 5**. El despliegue anidado completo todavía no está documentado aquí; si necesitas ayuda escríbenos a [accelcom@bsc.es](mailto:accelcom@bsc.es).
:::

### En local con MiniDMR

Para probar DMR en tu propia máquina sin acceso a HPC, usa MiniDMR, que levanta un clúster de Slurm basado en Docker. Consulta [Configuración local rápida](local-setup).

## Siguientes pasos

- [Modos de operación](modes-of-operation): cuándo usar DMR@Jobs y cuándo Slurm4DMR.
- [Estructura de la aplicación](../user-guide/app-structure): el ciclo de vida completo y `DMR_AUTO`.
- [Configuración](../user-guide/configuration): opciones de tiempo de ejecución y de compilación.
