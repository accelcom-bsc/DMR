---
sidebar_position: 2
title: Configuración rápida local
---

La forma más rápida de probar DMR en local es usar **MiniDMR**, una CLI que levanta en segundos un clúster Slurm multinodo basado en Docker, sin necesidad de acceso a HPC.

## 1. Instalar MiniDMR

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="os">
  <TabItem value="linux" label="Linux / macOS">

```bash
curl -fsSL https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.sh | bash
```

  </TabItem>
  <TabItem value="windows" label="Windows (PowerShell)">

```powershell
irm https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.ps1 | iex
```

El script añade automáticamente el directorio de instalación al `PATH` del usuario.

  </TabItem>
</Tabs>

## 2. Arrancar un clúster

```bash
minidmr start
minidmr enter   # te lleva al nodo controlador
```

Ahora estás dentro de un contenedor con Open MPI, Slurm y DMR preinstalados.

## 3. Escribir tu primera aplicación DMR

Dentro del clúster, crea `hello_dmr.c`:

```c
#include <mpi.h>
#include <stdio.h>
#include <unistd.h>
#include "dmr.h"

static void save(void)    { /* guardar el estado antes de que salgan los procesos */ }
static void load(void)    { /* restaurar el estado después del reinicio */ }
static void cleanup(void) { }

int main(int argc, char *argv[])
{
    MPI_Init(&argc, &argv);

    /* Con checkpoint-restart, main() se vuelve a llamar desde cero.
       load() se invoca aquí al reiniciar después de una reconfiguración. */
    DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), cleanup());

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    /* Mostrar el número actual de procesos para ver cómo ocurre la expansión. */
    if (rank == 0) printf("Running with %d process(es)\n", size);

    /* Cada vez que se ejecuta main() comprobamos el tamaño actual. Si hay menos
       de 4 procesos, pedimos una expansión. DMR hará checkpoint, saldrá y
       relanzará el ejecutable con un nodo más; main() volverá a empezar desde arriba. */
    if (size < 4) {
        /* Dormir antes de pedir la siguiente expansión. Las expansiones
           consecutivas que llegan demasiado rápido pueden provocar que las
           operaciones MPI spawn se solapen y fallen al lanzarse. */
        sleep(1);
        DMR_AUTO(dmr_check(SHOULD_EXPAND), save(), (void)NULL, cleanup());
    }

    /* Se llega aquí cuando size >= 4: ya está todo hecho. */
    DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
    MPI_Finalize();
    return 0;
}
```

## 4. Compilar y ejecutar

```bash
mpicc -o hello_dmr hello_dmr.c -ldmr
```

DMR debe ejecutarse dentro de una **asignación de trabajo Slurm** mediante el wrapper `dmr`. Crea un script de envío `submit.sh`:

```bash
#!/bin/bash
#SBATCH --time=00:10:00
#SBATCH --exclusive
#SBATCH -N 1

export DMR_PROCS_PER_NODE=1

NODELIST_WITH_COUNTS=$(scontrol show hostnames "$SLURM_JOB_NODELIST" \
  | awk -v n="$DMR_PROCS_PER_NODE" '{print $1 ":" n}' \
  | paste -sd,)

dmr mpirun --host $NODELIST_WITH_COUNTS ./hello_dmr
```

Envía el trabajo y sigue la salida:

```bash
sbatch submit.sh
tail -f slurm-*.out
```

Deberías ver `Running with 1 process(es)`, después `Running with 2 process(es)` y así sucesivamente hasta 4.

## 5. Detener el clúster

```bash
exit          # salir del contenedor
minidmr stop
```

## Siguientes pasos

- [Instalación](installation): prepara DMR en un clúster real
- [Estructura de la aplicación](../user-guide/app-structure): entiende el ciclo de vida completo
- [Resumen de políticas](../user-guide/policies/overview): elige o implementa una política de escalado
