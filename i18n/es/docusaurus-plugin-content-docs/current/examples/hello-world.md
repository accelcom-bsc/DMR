---
sidebar_position: 1
title: Hola mundo
---

Una aplicación mínima de DMR que imprime el número actual de procesos después de cada reconfiguración.

Fuente: `examples/hello-world/` en el repositorio de DMR.

## Qué hace

1. Inicializa MPI y DMR.
2. Registra la política `round`.
3. Llama a `dmr_check` en cada iteración e imprime rank y tamaño.
4. Sale limpiamente tras el número configurado de iteraciones.

## Ejecutarlo

```bash
cd examples/hello-world
cmake -B build && cmake --build build

DMR_DEFAULT_POLICY_MIN=2 DMR_DEFAULT_POLICY_MAX=4 \
dmr mpirun -n 2 ./hello-world
```

Salida esperada:

```
[rank 0 / 2] iteration 0
[rank 1 / 2] iteration 0
-- reconfiguration: 2 -> 4 nodes --
[rank 0 / 4] iteration 1
[rank 1 / 4] iteration 1
[rank 2 / 4] iteration 1
[rank 3 / 4] iteration 1
```

## Puntos clave

- `on_expand` solo imprime el nuevo tamaño, no hay datos que redistribuir en este ejemplo de juguete.
- `on_exit` no hace nada porque no se asigna memoria en heap por rank.
