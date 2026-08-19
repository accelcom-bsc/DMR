---
sidebar_position: 6
title: MiniDMR Local Cluster
---

**MiniDMR** is a CLI tool for creating and managing local Docker-based DMR clusters. It is the recommended way to run DMR locally for demos, development, and CI pipelines.

## Use cases

| Use case | Description |
|----------|-------------|
| **Demos / workshops** | Reproducible multi-node cluster, starts and stops cleanly |
| **DMR core development** | Container images with all dependencies preinstalled |
| **App development** | Separate image with DMR fully installed; focus on your app |
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
| `exec` | Run an arbitrary command on the controller node |
| `srun` | Run a Slurm job on the cluster via `srun`, blocking |
| `sbatch` | Submit a batch job to the cluster via `sbatch` |
| `install` | Install RPM packages with `dnf` in the running cluster |
| `upgrade` | Upgrade `minidmr` to the latest or a specific release |
| `status` | Show whether the cluster is running and how many nodes it has |
| `stop` | Stop and remove all containers |
| `version` | Print the current version |
| `completion` | Generate shell autocompletion scripts |
| `help` | Display help about any command |

## Quick example

```bash
# Start a 4-node cluster
minidmr start --nodes 4

# Start a cluster whose image already ships with the user, injecting env vars
# into every container (controller + workers)
minidmr start --no-user-setup -e DMR_PATH=/home/malluser/dmr

# Enter the controller node
minidmr enter

# Run an arbitrary command on the controller node (e.g. to compile DMR)
minidmr exec -u malluser -- bash -c 'source env_setup.sh && ./build.sh'

# Run a Slurm job, blocking until it finishes; the exit code is propagated
minidmr srun -u malluser -e DMR_CHECKPOINT_RESTART=1 -- -N2 mpirun ./my_test

# Submit a batch job via sbatch, from a script on the controller node
minidmr sbatch -u malluser -- job.sbatch

# Or, for a quick one-off job without a script file
minidmr sbatch -u malluser -- --wrap 'hostname'

# Install packages on all cluster nodes
minidmr install blas-devel lapack-devel

# Install a package only on the controller node
minidmr install --controller-only gcc-gfortran

# Upgrade minidmr to the latest release
minidmr upgrade

# Check whether the cluster is running and how many nodes it has
minidmr status

# Same, as machine-readable JSON
minidmr status --json

# Stop and remove the cluster
minidmr stop
```

## Running DMR tests

```bash
minidmr start --nodes 4
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

## Global flags

| Flag | Description | Default |
|------|-------------|---------|
| `--data_dir` | Directory for storing cluster data and configuration | `$HOME/.minihpc` |

## start flags

| Flag | Description | Default |
|------|-------------|---------|
| `-i, --image` | Container image to use | `slurm-docker-cluster:slurm4dmr` |
| `-n, --nodes` | Number of `slurmd` nodes | `4` |
| `--packages-file` | JSON package manifest installed after startup | `$data_dir/packages.json` if it exists |
| `--no-user-setup` | Skip creating/configuring the demo user, for images that already ship with the target user | `false` |
| `-e, --env` | Env var (`KEY=VALUE`) injected into every container; repeatable | - |

By default, `start` looks for a package manifest at `$data_dir/packages.json` and installs it when present. The manifest can be a plain array:

```json
["blas-devel", "lapack-devel"]
```

Or an object with packages for all nodes and controller-only packages:

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

## upgrade flags

| Flag | Description |
|------|-------------|
| `-v, --version` | Install a specific release tag instead of the latest |

## status flags

| Flag | Description |
|------|-------------|
| `--json` | Output status as JSON instead of human-readable text |

## enter flags

| Flag | Description |
|------|-------------|
| `-w, --workdir` | Working directory inside the container (default: mapped from current working directory) |

:::note
If stopped containers from a previous cluster are found (e.g. after a reboot), `minidmr start` resumes them instead of creating a new cluster. If `--nodes` is explicitly set and differs from the previous cluster size, `start` asks whether to remove the old cluster and create a new one.
:::
