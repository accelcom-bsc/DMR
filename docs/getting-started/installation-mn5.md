---
sidebar_position: 3
title: MareNostrum 5 Manual Install
---

On MareNostrum 5 you can simply load the pre-installed modules (recommended):

```bash
module use /apps/GPP/DMR/dmr-modules
module load openpmix-for-dmr
module load prrte-for-dmr
module load openmpi-for-dmr
module load dlb-for-dmr   # only needed for the CE policy
```

If you want to build the dependencies manually, follow the instructions below. Set your prefix variables first:

```bash
export OPENPMIX_PREFIX=/path/to/openpmix
export PRRTE_PREFIX=/path/to/prrte
export OMPI_PREFIX=/path/to/ompi
```

## OpenPMIX

```bash
git clone https://github.com/openpmix/openpmix.git
cd openpmix
git submodule update --init
./autogen.pl
./configure --prefix=$OPENPMIX_PREFIX --disable-debug
make -j112 install
cd ..

export LD_LIBRARY_PATH=$OPENPMIX_PREFIX/lib:$LD_LIBRARY_PATH
```

## PRRTE

```bash
git clone https://github.com/openpmix/prrte.git
cd prrte
git submodule update --init
./autogen.pl
./configure --prefix=$PRRTE_PREFIX --disable-debug \
  --with-pmix=$OPENPMIX_PREFIX --without-slurm --without-pbs
make -j112 install
cd ..
```

## Open MPI

```bash
git clone https://github.com/open-mpi/ompi.git
cd ompi
git submodule update --init config/oac 3rd-party/pympistandard
./autogen.pl --no-3rdparty openpmix,prrte
./configure --prefix=$OMPI_PREFIX --disable-debug \
  --with-libevent=external --with-hwloc=external \
  --with-pmix=$OPENPMIX_PREFIX --with-prrte=$PRRTE_PREFIX \
  --with-ucx=/apps/GPP/UCX/1.16.0/GCC
make -j112 install
cd ..

export PATH=$OMPI_PREFIX/bin:$PATH
export LD_LIBRARY_PATH=$OMPI_PREFIX/lib:$LD_LIBRARY_PATH
```

## TALP / DLB (optional)

Required only for the `ce` policy. Export `DLB_PREFIX` to your desired location.

```bash
export DLB_PREFIX=/path/to/dlb

wget https://pm.bsc.es/ftp/dlb/releases/dlb-3.5.2.tar.gz
tar -xvf dlb-3.5.2.tar.gz
cd dlb-3.5.2
./configure --prefix=$DLB_PREFIX --with-mpi=$OMPI_PREFIX
make -j112
make install
cd ..

# Add to .bashrc:
LD_PRELOAD="$DLB_PREFIX/lib/libdlb_mpi.so"
export DLB_ARGS="--talp --talp-external-profiler --quiet"
```
