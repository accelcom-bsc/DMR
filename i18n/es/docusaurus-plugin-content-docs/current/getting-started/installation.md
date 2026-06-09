---
sidebar_position: 3
title: Instalación
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Esta página explica cómo **compilar DMR desde el código fuente**.

:::tip[En MareNostrum 5 no necesitas esto]
Un módulo precompilado ya proporciona la biblioteca, los encabezados y todas las dependencias:

```bash
module load dmr
```

Úsalo para ejecuciones normales y sáltate esta página; consulta [Compilar y ejecutar tu aplicación](building-and-running). Sigue los pasos de abajo solo si quieres compilar DMR desde el código fuente (por ejemplo, para modificarlo).
:::

DMR necesita dos cosas: sus **dependencias** (una compilación concreta de Open MPI con OpenPMIX y PRRTE externos) y **el propio DMR**. Una vez instalados ambos, en [Compilar y ejecutar tu aplicación](building-and-running) se explica cómo compilar y lanzar tu programa.

## 1. Obtener las dependencias

<Tabs groupId="system">
  <TabItem value="mn5" label="MareNostrum 5">

En lugar de compilar OpenPMIX, PRRTE y Open MPI desde cero, carga los módulos precompilados de MN5:

```bash
module use /apps/GPP/DMR/dmr-modules
module load openpmix-for-dmr
module load prrte-for-dmr
module load openmpi-for-dmr
module load dlb-for-dmr   # opcional, solo para la política CE
```

Esto define automáticamente `OPENPMIX_PREFIX`, `PRRTE_PREFIX`, `OMPI_PREFIX` y `DLB_PREFIX`.

:::note
Si no puedes usar los módulos precompilados, sigue la pestaña **Otros sistemas** con rutas específicas de MN5, añadiendo la ruta de UCX de MN5 al `./configure` de Open MPI (`--with-ucx=/apps/GPP/UCX/1.16.0/GCC`).
:::

  </TabItem>
  <TabItem value="other" label="Otros sistemas">

DMR requiere una compilación concreta de Open MPI con OpenPMIX y PRRTE externos. La versión de Open MPI que trae tu sistema casi con toda seguridad no será compatible.

:::caution
Aunque ya tengas Open MPI instalado, sigue estos pasos. Las funciones necesarias de PRRTE no están presentes en las distribuciones estándar.
:::

Define los prefijos de instalación:

```bash
export OPENPMIX_PREFIX=/path/to/openpmix
export PRRTE_PREFIX=/path/to/prrte
export OMPI_PREFIX=/path/to/ompi
```

**OpenPMIX**

```bash
git clone https://github.com/openpmix/openpmix.git
cd openpmix && git submodule update --init
./autogen.pl
./configure --prefix=$OPENPMIX_PREFIX --disable-debug
make -j$(nproc) install && cd ..
export LD_LIBRARY_PATH=$OPENPMIX_PREFIX/lib:$LD_LIBRARY_PATH
```

**PRRTE**

```bash
git clone https://github.com/openpmix/prrte.git
cd prrte && git submodule update --init
./autogen.pl
./configure --prefix=$PRRTE_PREFIX --disable-debug \
  --with-pmix=$OPENPMIX_PREFIX --without-slurm --without-pbs
make -j$(nproc) install && cd ..
```

**Open MPI**

```bash
git clone https://github.com/open-mpi/ompi.git
cd ompi && git submodule update --init config/oac 3rd-party/pympistandard
./autogen.pl --no-3rdparty openpmix,prrte
./configure --prefix=$OMPI_PREFIX --disable-debug \
  --with-libevent=external --with-hwloc=external \
  --with-pmix=$OPENPMIX_PREFIX --with-prrte=$PRRTE_PREFIX \
  --with-ucx        # opcional, pero recomendable
make -j$(nproc) install && cd ..
export PATH=$OMPI_PREFIX/bin:$PATH
export LD_LIBRARY_PATH=$OMPI_PREFIX/lib:$LD_LIBRARY_PATH
```

Añade las líneas `export` a tu `.bashrc`. En algunos sistemas:

```bash
sudo dnf install flex libevent-devel hwloc-devel
```

**DLB / TALP** (opcional, solo para la política CE)

```bash
export DLB_PREFIX=/path/to/dlb
wget https://pm.bsc.es/ftp/dlb/releases/dlb-3.5.2.tar.gz
tar -xvf dlb-3.5.2.tar.gz && cd dlb-3.5.2
./configure --prefix=$DLB_PREFIX --with-mpi=$OMPI_PREFIX
make -j$(nproc) install && cd ..
# Añade esto a .bashrc:
LD_PRELOAD="$DLB_PREFIX/lib/libdlb_mpi.so"
export DLB_ARGS="--talp --talp-external-profiler --quiet"
```

**Conectar con Slurm.** CMake detecta tu instalación de Slurm automáticamente. Si falla:

```bash
ldd $(which sbatch) | grep libslurm   # encontrar la ruta de la biblioteca
export SLURM_LIB=/usr/lib64/slurm     # definirla
```

Si faltan los encabezados de Slurm, clona el código fuente de Slurm correspondiente:

```bash
sinfo --version   # averigua tu versión
git clone --depth 1 --branch <version> https://github.com/SchedMD/slurm
export SLURM_INCLUDE=/path/to/slurm/slurm
```

Renombra `slurm_version.h.in` a `slurm_version.h` y añade antes del `#endif` final:

```c
#define SLURM_VERSION_NUMBER SLURM_VERSION_NUM(a,b,c)
```

  </TabItem>
</Tabs>

## 2. Compilar DMR

Con las dependencias listas, la compilación es la misma en cualquier sistema:

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
cmake -B build -DCMAKE_INSTALL_PREFIX=/path/to/install
cmake --build build -j$(nproc)
cmake --install build
```

Define opciones adicionales según necesites:

```bash
cmake -B build \
  -DCMAKE_INSTALL_PREFIX=/path/to/install \
  -DDMR_PROCS_PER_NODE=112 \
  -DDMR_USE_TALP=1
```

En MN5, usa `-j112` para ajustarte a los núcleos por nodo. Consulta [Configuración](../user-guide/configuration) para ver la lista completa de opciones de CMake.

:::info[Pendiente de documentar]
La compilación de Slurm4DMR con un Slurm personalizado en MareNostrum 5 todavía no se cubre aquí. Si necesitas ayuda, escríbenos a [accelcom@bsc.es](mailto:accelcom@bsc.es).
:::

## Siguiente paso

Con DMR instalado, consulta [Compilar y ejecutar tu aplicación](building-and-running) para compilar tu código contra DMR y lanzarlo.
