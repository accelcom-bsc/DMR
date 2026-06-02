---
sidebar_position: 6
title: Redistribución de datos
---

Cuando ocurre una reconfiguración, todos los procesos salen y el ejecutable se reinicia desde cero con el nuevo número de procesos. Antes de salir, los procesos antiguos deben transferir su estado a los nuevos para que la aplicación pueda continuar correctamente.

DMR admite dos formas de hacerlo, seleccionadas en tiempo de compilación con `DMR_CHECKPOINT_RESTART`.

## Checkpoint-restart (predeterminado)

`DMR_CHECKPOINT_RESTART=1`

Los procesos antiguos escriben su estado en disco (`redist_func`) y después salen. Los procesos nuevos arrancan desde el principio del ejecutable y leen ese estado de vuelta (`restart_func`).

```
old processes          new processes
      │                      │
  redist_func()              │  ← guardar estado en disco
      │                      │
    exit                     │
                         main() starts
                         restart_func() ← cargar estado desde disco
                             │
                         continue...
```

Usa este modo cuando ya tengas lógica de checkpoint en tu aplicación o cuando tu sistema no soporte la versión personalizada de PRRTE necesaria para el modo intercomunicador.

## Intercomunicador

`DMR_CHECKPOINT_RESTART=0`

Los procesos antiguos y los nuevos están **vivos al mismo tiempo** durante una pequeña ventana. DMR expone `DMR_INTERCOMM`, un intercomunicador MPI que conecta ambos conjuntos de procesos para que puedan intercambiar datos directamente. Una vez finalizada la transferencia, los procesos antiguos salen. Los procesos nuevos también arrancan desde el principio del ejecutable.

```
old processes          new processes
      │                      │
  redist_func()          main() starts  ← ambos siguen vivos a la vez
  send via INTERCOMM     restart_func()
      │                  recv via INTERCOMM
    exit                     │
                         continue...
```

Usa `dmr_intercomm_available()` para comprobar si `DMR_INTERCOMM` es válido antes de utilizarlo.

:::note[En progreso]
Pronto añadiremos ejemplos de uso detallados para el modo intercomunicador.
:::
