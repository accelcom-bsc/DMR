---
sidebar_position: 2
title: Conjunto de datos distribuido
---

Muestra cómo gestionar un conjunto de datos distribuido a través de reconfiguraciones dinámicas.

Fuente: `examples/distributed-dataset-sleep/` en el repositorio de DMR.

## Qué hace

1. Cada proceso posee un segmento contiguo de un array global de enteros.
2. En una expansión, los datos se redistribuyen para incluir a los nuevos procesos.
3. En una reducción, los procesos que salen envían sus datos a los supervivientes antes de terminar.
4. Cada iteración duerme para simular trabajo.

## Redistribución de datos

```
Before expand (2 ranks):   rank 0: [0,1,2,3]   rank 1: [4,5,6,7]
After expand  (4 ranks):   rank 0: [0,1]   rank 1: [2,3]   rank 2: [4,5]   rank 3: [6,7]
```

Usa `MPI_Scatterv` para expandir y `MPI_Gatherv` + `MPI_Scatterv` para reducir.

## Ejecutarlo

```bash
cd examples/distributed-dataset-sleep
cmake -B build && cmake --build build

DMR_DEFAULT_POLICY_MIN=1 DMR_DEFAULT_POLICY_MAX=8 DMR_DEFAULT_POLICY_STRIDE=2 \
dmr mpirun -n 1 ./distributed-dataset-sleep --array-size 64 --iterations 20
```

## Puntos clave

- `on_exit` **debe** enviar el segmento local a un rank superviviente antes de retornar; si no, los datos se pierden.
- Tras una reconfiguración, recalcula los límites del segmento local a partir del nuevo `MPI_Comm_size`.
