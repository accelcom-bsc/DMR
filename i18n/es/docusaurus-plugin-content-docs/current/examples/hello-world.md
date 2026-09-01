---
sidebar_position: 1
title: Hola mundo
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Una aplicación mínima de DMR que muestra cómo funcionan las reconfiguraciones sin transferir datos de la aplicación.

Fuente: el repositorio del ejemplo [`hello-world`](https://gitlab.bsc.es/accelcom/releases/dmr/examples/hello-world).

## Qué hace

1. Inicializa MPI y DMR.
2. Registra funciones de restart, checkpoint y finalize mediante `DMR_AUTO`.
3. Usa una política de DMR para solicitar una reconfiguración.
4. Imprime qué rank está ejecutándose, haciendo checkpoint, reiniciándose o saliendo.
5. Termina después del número configurado de reconfiguraciones.

El mismo código fuente se puede compilar y lanzar con DMR@Jobs, Slurm4DMR o MiniDMR.

## Prerrequisitos

Clona o entra en el repositorio del ejemplo:

```bash
cd hello-world
```

El Makefile espera que `DMR_PATH` apunte a la instalación de DMR. El objetivo de Slurm4DMR también espera `DLB_HOME`.

## Elegir modo de ejecución

<Tabs groupId="hello-world-mode">
  <TabItem value="dmrjobs" label="DMR@Jobs">

DMR@Jobs usa la instancia Slurm del sistema. En MN5, carga el módulo precompilado de DMR:

```bash
module load dmr
```

Comprueba que el módulo ha definido `DMR_PATH`:

```bash
echo "$DMR_PATH"
```

Compila:

```bash
make clean
make helloJobs
```

Configura el script batch de MN5 (`start_dmratjobs.sh`):

```bash
#SBATCH --time=00:30:00
#SBATCH --exclusive
#SBATCH -N1
#SBATCH --qos=gp_bsccs
#SBATCH -A bsc85

export DMR_NODES_IN_EXPAND=1
export DMR_PROCS_PER_NODE=2
```

Ejecuta:

```bash
sbatch start_dmratjobs.sh
```

`start_dmratjobs.sh` construye la lista de hosts PRRTE a partir de la asignación de Slurm y lanza:

```bash
$DMR_PATH/scripts/dmr_wrapper prterun --host "$NODELIST_WITH_COUNTS" ./hello-world
```

Este modo usa `TEST_POLICY`. Se expande a un nuevo trabajo Slurm, se reduce de nuevo a un solo trabajo y termina.

  </TabItem>
  <TabItem value="slurm4dmr" label="Slurm4DMR">

Slurm4DMR ejecuta una instancia Slurm anidada dentro de una asignación externa de MN5. A diferencia de DMR@Jobs, requiere instalar Slurm4DMR manualmente antes; consulta [Instalación](../getting-started/installation#2-compilar-dmr).

Después de instalar DMR con soporte Slurm4DMR y el Slurm personalizado, carga los módulos de dependencias de MN5:

```bash
module use /apps/GPP/DMR/dmr-modules
module load dlb-for-dmr
module load openpmix-for-dmr
module load prrte-for-dmr
module load openmpi-for-dmr
```

Define las rutas que usa el lanzador de Slurm anidado:

```bash
export DMR_PATH=/path/to/dmr
export SLURM_ROOT=/path/to/slurm4dmr
export SLURM_CONFDIR_BASE=/path/to/slurm4dmr-confdir
export DLB_HOME="${DLB_HOME:-$DLB_PREFIX}"
```

Compila:

```bash
make clean
make helloSlurm
```

Configura el script batch externo de MN5 (`start_slurm4dmr.sh`):

```bash
#SBATCH --time=00:15:00
#SBATCH --exclusive
#SBATCH -N9
#SBATCH -o slurm4dmr.log
#SBATCH --qos=gp_debug
#SBATCH -A bsc85
```

Configura el script interno enviado a la instancia Slurm anidada:

```bash
#SBATCH --time=00:30:00
#SBATCH --exclusive
#SBATCH -N4

export DMR_PROCS_PER_NODE=1
```

Ejecuta:

```bash
sbatch start_slurm4dmr.sh
```

`start_slurm4dmr.sh` despliega la infraestructura Slurm anidada y envía automáticamente `submit_custom_slurm.sh`. El trabajo interno lanza:

```bash
$DMR_PATH/scripts/dmr_wrapper mpirun --host "$NODELIST_WITH_COUNTS" ./hello-world
```

Este modo usa `SLURM4DMR_ROUND_POLICY` y se reconfigura hasta `MAX_ITERS_SLURM4DMR` veces.

  </TabItem>
  <TabItem value="minidmr" label="MiniDMR">

MiniDMR ejecuta la versión Slurm4DMR de DMR en un clúster Slurm local basado en Docker. Úsalo cuando quieras reproducir el flujo Slurm4DMR sin usar una asignación de MN5.

:::note
MiniDMR no es un modo de ejecución de MN5. Es un entorno local de pruebas para Slurm4DMR.
:::

Arranca un clúster local desde el host. `start_minidmr.sh` pide 4 nodos y el ejemplo puede expandirse a 8, así que arranca MiniDMR con 8 workers:

```bash
minidmr start --nodes 8
```

Entra en el controlador de MiniDMR desde el directorio del ejemplo:

```bash
cd hello-world
minidmr enter
```

Compila:

```bash
make helloSlurm
```

Ejecuta:

```bash
sbatch --wait start_minidmr.sh
```

El trabajo escribe en `slurm-<jobid>.out`.

Cuando termines, para el clúster local:

```bash
exit
minidmr stop
```

  </TabItem>
</Tabs>

Los nombres de nodo y el orden de ranks dependen de la asignación. La salida debe mostrar al rank 0 informando del contador de reconfiguración, ranks haciendo checkpoint/finalize antes de salir, ranks reiniciados entrando en la nueva asignación y líneas finales de `Goodbye world` al alcanzar el número de reconfiguraciones configurado. Por ejemplo:

```text
[1/4] Hello world from mc-slurmd-1. DMR's reconfiguration count is 0.
[1/8] Hello world from mc-slurmd-1. DMR's reconfiguration count is 1.
...
Goodbye world from rank 0 on mc-slurmd-1. DMR's reconfiguration count is 10.
```

## Puntos clave

- `restart` imprime que el rank se ha reiniciado; un programa real recargaría o reconstruiría sus datos.
- `checkpoint` imprime que el rank ha hecho checkpoint; un programa real guardaría o transferiría datos antes de la reconfiguración.
- `finalize` imprime que el rank está a punto de salir; un programa real liberaría recursos.
- DMR@Jobs usa un bucle de espera infinito porque las peticiones de expansión no son bloqueantes por defecto.
- Durante una reconfiguración, los ranks llaman a los hooks de checkpoint/finalize antes de salir, y los ranks reiniciados llaman al hook de restart después de que DMR relance el programa.
