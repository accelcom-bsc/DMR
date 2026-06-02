---
sidebar_position: 5
title: Primeros pasos con DMR
---

Esta guía te ayuda a evaluar si DMR encaja con tu aplicación y repasa los pasos clave para integrarlo.

## ¿Es DMR adecuado para tu aplicación?

DMR funciona bien cuando:

- Tu aplicación está **basada en MPI y es iterativa**: tiene un bucle principal en el que todos los ranks se sincronizan periódicamente.
- Tu carga de trabajo tiene **fases con necesidades de recursos distintas**: por ejemplo, una fase intensiva en cómputo que se beneficia de más nodos y una fase intensiva en comunicación que no.
- Puedes tolerar una **breve interrupción** en los puntos de reconfiguración, cuando el conjunto de procesos cambia entre iteraciones.

Es menos adecuado cuando:

- Tu aplicación no tiene puntos claros de sincronización, está muy acoplada y no tiene estructura de bucle.
- El coste de guardar y restaurar el estado es demasiado alto en comparación con el tiempo que ahorras al escalar.

**Si tu aplicación ya implementa checkpoint-restart**, adoptar DMR es muy sencillo: conecta tu lógica actual de guardado y carga a `redist_func` y `restart_func`, y añade `dmr_check` en el punto del checkpoint.

## Encontrar buenos puntos de reconfiguración

Un punto de reconfiguración es donde DMR pausa la ejecución, cambia el conjunto de procesos y reanuda. Los mejores candidatos son **puntos naturales de sincronización** que ya existen en tu código:

- El límite entre iteraciones en tu bucle principal.
- Justo antes o después de una operación colectiva (`MPI_Barrier`, `MPI_Allreduce`, `MPI_Bcast`, etc.).
- Entre fases distintas de tu aplicación, por ejemplo después de una etapa de resolución y antes de una etapa de posprocesado.

Evita los puntos en los que:

- Hay operaciones MPI no bloqueantes pendientes (`MPI_Isend`/`MPI_Irecv` que aún no han terminado).
- Mantienes abiertas ventanas MPI (`MPI_Win`) o épocas activas.
- Estás dentro de un comunicador distinto de `MPI_COMM_WORLD`.

Un único punto bien elegido por iteración basta para la mayoría de las aplicaciones.

## Preparar la redistribución de datos

Este es el principal trabajo de integración. Debes responder a esta pregunta: ¿qué estado debe sobrevivir a una reconfiguración?

Estado típico que hay que guardar:

- El contador de iteración o el paso temporal de la simulación.
- Arrays o vectores distribuidos, donde cada rank guarda su partición local.
- Cualquier cantidad derivada que sea costosa de recalcular.

**Si ya tienes checkpoint-restart**, mapéalo directamente:

```c
// redist_func: se llama antes de que este rank salga
void save(void) {
    write_checkpoint("checkpoint.bin", my_data, my_iteration);
}

// restart_func: se llama al reiniciar después de una reconfiguración
void load(void) {
    read_checkpoint("checkpoint.bin", &my_data, &my_iteration);
}
```

Después añade DMR a tu bucle principal:

```c
DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), (void)NULL);

while (my_iteration < max_iterations) {
    DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, (void)NULL);
    do_work();
    my_iteration++;
}
```

**Si no tienes checkpoint-restart**, tendrás que implementar el guardado y la carga desde cero. La pregunta clave es si guardar el estado en disco en cada posible punto de reconfiguración es asumible. Si lo es, adelante. Si el estado es demasiado grande o el coste de E/S es demasiado alto, considera el [modo intercomunicador](../user-guide/data-redistribution#intercomunicador) en su lugar.

Para una explicación completa del ciclo de vida y de la macro `DMR_AUTO`, consulta [Estructura de la aplicación](../user-guide/app-structure).

## Compromisos

**Ventajas**

- Escalar hacia arriba o hacia abajo durante la ejecución sin relanzar el trabajo, conservando tu posición en la cola.
- Devolver recursos ociosos al clúster entre fases, mejorando la utilización global.
- Adaptarte en tiempo de ejecución a fases de la carga de trabajo con requisitos de recursos distintos.
- Si tu aplicación ya implementa checkpoint-restart, la integración es mínima.

**Inconvenientes**

- Las reconfiguraciones añaden sobrecoste porque la aplicación debe esperar a que Slurm conceda los recursos solicitados. El tiempo de espera depende de la presión de la cola del clúster.
- Debes identificar puntos seguros de reconfiguración en tu bucle principal.
- La lógica de guardado y restauración del estado debe implementarse y probarse si aún no existe.
