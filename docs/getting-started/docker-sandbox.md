---
sidebar_position: 6
title: MiniDMR — Local Cluster
---

**MiniDMR** is a CLI tool for creating and managing local Docker-based DMR clusters. It is the recommended way to run DMR locally for demos, development, and CI pipelines.

## Use cases

| Use case | Description |
|----------|-------------|
| **Demos / workshops** | Reproducible multi-node cluster, starts and stops cleanly |
| **DMR core development** | Container images with all dependencies preinstalled |
| **App development** | Separate image with DMR fully installed — focus on your app |
| **CI pipelines** | Temporary containerized cluster for integration testing |

## Installation

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="os">
  <TabItem value="linux" label="Linux / macOS">

  Latest release:
  ```bash
  curl -fsSL https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.sh | bash
  ```

  Specific version (e.g. `v0.0.4`):
  ```bash
  curl -fsSL https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.sh | bash -s -- v0.0.4
  ```

  Install to a custom directory (no `sudo`):
  ```bash
  curl -fsSL .../install.sh | bash -s -- --install-dir ~/.local/bin
  ```

  </TabItem>
  <TabItem value="windows" label="Windows (PowerShell)">

  Latest release:
  ```powershell
  irm https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/raw/master/scripts/install.ps1 | iex
  ```

  Specific version:
  ```powershell
  & ([scriptblock]::Create((irm .../install.ps1))) -Version v0.0.4
  ```

  </TabItem>
</Tabs>

For manual installation, download the binary from the [Releases page](https://gitlab.bsc.es/accelcom/releases/dmr/tools/minidmr/-/releases).

## Commands

| Command | Description |
|---------|-------------|
| `start` | Start a multi-node Docker-based DMR cluster |
| `enter` | Drop into the controller node interactively |
| `install` | Install RPM packages with `dnf` in the running cluster |
| `upgrade` | Upgrade `minidmr` to the latest or a specific release |
| `stop` | Stop and remove all containers |
| `version` | Print the current version |

## Quick example

```bash
# Start a 4-node cluster
minidmr start --nodes 4 --project demo

# Enter the controller node
minidmr enter

# Stop and remove the cluster
minidmr stop
```

## Running DMR tests

```bash
minidmr start --nodes 4 --project dmr-tests
minidmr enter
```

Inside the controller node:

```bash
git clone https://gitlab.bsc.es/accelcom/releases/dmr/dmr.git
cd dmr
export DMR_PATH=$(pwd)

cd tests/ci
./dmr_full_test_run.sh compile/build_slurm4dmr_notalp.sh
```

The `build_slurm4dmr_notalp.sh` script is compatible with MiniDMR out of the box.

## start flags

| Flag | Description | Default |
|------|-------------|---------|
| `-i, --image` | Container image to use | `slurm-docker-cluster:slurm4dmr` |
| `-n, --nodes` | Number of `slurmd` nodes | `4` |
| `--packages-file` | JSON package manifest installed after startup | `$HOME/.minihpc/packages.json` |

Package manifest format:

```json
{
  "packages": ["blas-devel", "lapack-devel"],
  "controller": ["gcc-gfortran"]
}
```

## install flags

| Flag | Description |
|------|-------------|
| `-c, --controller-only` | Install only on the controller node |

:::note
If stopped containers from a previous cluster are found (e.g. after a reboot), `minidmr start` resumes them instead of creating a new cluster.
:::
