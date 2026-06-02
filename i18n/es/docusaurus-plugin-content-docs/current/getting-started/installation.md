---
sidebar_position: 2
title: Instalación
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="system">
  <TabItem value="mn5" label="MareNostrum 5">

## MareNostrum 5

La forma más sencilla es cargar el módulo precompilado de DMR y listo, sin necesidad de compilar nada.

```bash
module use /apps/GPP/DMR/dmr-modules
module load dmr
```

Ese único módulo proporciona la biblioteca, los encabezados y todas las dependencias (Open MPI, PRRTE y OpenPMIX). Úsalo para ejecuciones de producción.

Si necesitas **compilar DMR tú mismo** en MN5, por ejemplo para modificar el código fuente, consulta [Compilación manual en MareNostrum 5](installation-mn5).

  </TabItem>
  <TabItem value="other" label="Otros sistemas">

## Otros sistemas

### 1. Compilar las dependencias

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

### 2. Conectar con Slurm

CMake detecta tu instalación de Slurm automáticamente. Si falla:

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

### 3. Compilar DMR

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
cmake -B build -DCMAKE_INSTALL_PREFIX=/path/to/install
cmake --build build
cmake --install build
```

Consulta [Configuración](../user-guide/configuration) para ver la lista completa de opciones de CMake.

  </TabItem>
</Tabs>

## Enlazar tu aplicación

```c
#include "dmr.h"
```

```bash
mpicc -o my_app my_app.c -ldmr
```

Con CMake:

```cmake
find_package(DMR REQUIRED)
target_link_libraries(my_app PRIVATE DMR::dmr)
```
