---
sidebar_position: 7
title: Clúster local MiniDMR
---

**MiniDMR** es una herramienta de línea de comandos para crear y gestionar clústeres DMR locales basados en Docker. Es la forma recomendada de ejecutar DMR en local para demos, desarrollo y pipelines de CI.

## Casos de uso

| Caso de uso | Descripción |
|----------|-------------|
| **Demos / talleres** | Clúster multinodo reproducible, arranca y se detiene de forma limpia |
| **Desarrollo del núcleo de DMR** | Imágenes de contenedor con todas las dependencias preinstaladas |
| **Desarrollo de aplicaciones** | Imagen separada con DMR completamente instalado para centrarte en tu aplicación |
| **Pipelines de CI** | Clúster temporal en contenedores para pruebas de integración |

## Instalación

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="os">
  <TabItem value="linux" label="Linux / macOS">

  Última versión:
  ```bash
  curl -fsSL https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.sh | bash
  ```

  Versión concreta, por ejemplo `v0.0.4`:
  ```bash
  curl -fsSL https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.sh | bash -s -- v0.0.4
  ```

  Instalar en un directorio personalizado, sin `sudo`:
  ```bash
  curl -fsSL .../install.sh | bash -s -- --install-dir ~/.local/bin
  ```

  </TabItem>
  <TabItem value="windows" label="Windows (PowerShell)">

  Última versión:
  ```powershell
  irm https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.ps1 | iex
  ```

  Versión concreta:
  ```powershell
  & ([scriptblock]::Create((irm .../install.ps1))) -Version v0.0.4
  ```

  </TabItem>
</Tabs>

Para una instalación manual, descarga el binario desde la [página de releases](https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/releases).

## Comandos

| Comando | Descripción |
|---------|-------------|
| `start` | Arrancar un clúster DMR multinodo basado en Docker |
| `enter` | Entrar de forma interactiva en el nodo controlador |
| `install` | Instalar paquetes RPM con `dnf` en el clúster en ejecución |
| `upgrade` | Actualizar `minidmr` a la última versión o a una concreta |
| `stop` | Detener y eliminar todos los contenedores |
| `version` | Mostrar la versión actual |

## Ejemplo rápido

```bash
# Arrancar un clúster de 4 nodos
minidmr start --nodes 4

# Entrar en el nodo controlador
minidmr enter

# Detener y eliminar el clúster
minidmr stop
```

## Ejecutar pruebas de DMR

```bash
minidmr start --nodes 4
minidmr enter
```

Dentro del nodo controlador:

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
export DMR_PATH=$(pwd)

cd tests/ci
./dmr_full_test_run.sh compile/build_slurm4dmr_notalp.sh
```

El script `build_slurm4dmr_notalp.sh` es compatible con MiniDMR sin cambios.

## Flags de `start`

| Flag | Descripción | Valor predeterminado |
|------|-------------|---------|
| `-i, --image` | Imagen de contenedor a usar | `slurm-docker-cluster:slurm4dmr` |
| `-n, --nodes` | Número de nodos `slurmd` | `4` |
| `--packages-file` | Manifest JSON de paquetes que se instala tras el arranque | `$HOME/.minihpc/packages.json` |

Formato del manifest de paquetes:

```json
{
  "packages": ["blas-devel", "lapack-devel"],
  "controller": ["gcc-gfortran"]
}
```

## Flags de `install`

| Flag | Descripción |
|------|-------------|
| `-c, --controller-only` | Instalar solo en el nodo controlador |

:::note
Si se encuentran contenedores detenidos de un clúster anterior, por ejemplo después de reiniciar, `minidmr start` los reanuda en lugar de crear un clúster nuevo.
:::
