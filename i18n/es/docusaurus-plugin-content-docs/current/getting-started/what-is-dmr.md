---
sidebar_position: 1
title: ¿Qué es DMR?
---

DMR es una biblioteca que permite que tu aplicación basada en MPI **cambie su asignación de recursos durante la ejecución**. Por ejemplo, podrías lanzar tu aplicación con diez nodos y, en un momento dado de la ejecución, reducirla a un nodo y después ampliarla hasta usar veinte nodos.

La biblioteca gestiona en segundo plano la mayor parte de las operaciones complejas, así que, como desarrollador, tu foco principal está en implementar la lógica necesaria para redistribuir los datos de tu aplicación cuando cambian los recursos.

DMR está desarrollado y mantenido por el [Barcelona Supercomputing Center](https://www.bsc.es/).

## Características clave

- **Escalado dinámico** - amplía o reduce tu asignación de nodos Slurm en tiempo de ejecución sin reiniciar.
- **Basado en políticas** - elige una política de reconfiguración integrada o implementa la tuya propia.
- **Nativo de MPI** - se integra directamente con Open MPI; no necesitas cambiar tus llamadas MPI.
- **API mínima** - tres funciones principales: `dmr_init`, `dmr_check` y `dmr_finalize`.

## Cómo funciona

Tu aplicación llama a `dmr_check` en un punto del bucle principal en el que una reconfiguración sea segura. DMR evalúa la política activa y, si corresponde reconfigurar, coordina con Slurm la expansión o reducción del trabajo. Antes y después de la reconfiguración, DMR llama a tus callbacks de **expansión** y **reducción** para que puedas redistribuir los datos entre el nuevo conjunto de procesos.

```c
while (should_keep_running()) {
    DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());
    do_work();
}
```

## Licencia

DMR se distribuye bajo la **GNU General Public License, Version 2 (GPLv2)**.

© 2025 Barcelona Supercomputing Center.
