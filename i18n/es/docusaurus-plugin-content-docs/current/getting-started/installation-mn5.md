---
sidebar_position: 5
title: Compilación manual en MareNostrum 5
---

Usa esta guía solo si necesitas **compilar DMR desde el código fuente** en MareNostrum 5. Para uso normal, basta con `module load dmr` (consulta [Instalación](installation)).

## 1. Cargar los módulos de dependencias

En lugar de compilar OpenPMIX, PRRTE y Open MPI desde cero, carga los módulos precompilados de MN5:

```bash
module use /apps/GPP/DMR/dmr-modules
module load openpmix-for-dmr
module load prrte-for-dmr
module load openmpi-for-dmr
module load dlb-for-dmr   # opcional, solo para la política CE
```

Esto define automáticamente `OPENPMIX_PREFIX`, `PRRTE_PREFIX`, `OMPI_PREFIX` y `DLB_PREFIX`.

## 2. Compilar DMR

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
cmake -B build -DCMAKE_INSTALL_PREFIX=/path/to/install
cmake --build build -j112
cmake --install build
```

Si necesitas opciones adicionales, consulta [Configuración: opciones de CMake](../user-guide/configuration) para ver la lista completa:

```bash
cmake -B build \
  -DCMAKE_INSTALL_PREFIX=/path/to/install \
  -DDMR_PROCS_PER_NODE=112 \
  -DDMR_USE_TALP=1
```

:::info[Pendiente de documentar]
Las instrucciones para compilar Slurm4DMR con un Slurm personalizado en MareNostrum 5 todavía no están disponibles en esta documentación. Si necesitas ayuda, escríbenos a [accelcom@bsc.es](mailto:accelcom@bsc.es).
:::

## Compilar manualmente las dependencias (avanzado)

Si no puedes usar los módulos precompilados, sigue los mismos pasos que en [Otros sistemas](installation?system=other) usando rutas específicas de MN5. Para Open MPI, añade la ruta de UCX de MN5:

```bash
./configure ... --with-ucx=/apps/GPP/UCX/1.16.0/GCC
```

Y usa `-j112` en todos los comandos `make`.
