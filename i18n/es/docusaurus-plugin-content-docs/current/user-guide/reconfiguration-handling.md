---
sidebar_position: 2
title: Gestión de reconfiguraciones
---

`DMR_AUTO` dirige la ejecución al callback correcto según el `DMRAction` devuelto por una función DMR.

## Firma de DMR_AUTO

```c
DMR_AUTO(the_action, redist_func, restart_func, finalize_func)
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `the_action` | `DMRAction` | Valor devuelto por `dmr_init`, `dmr_check` o `dmr_finalize` |
| `redist_func` | expresión | Se llama cuando los datos deben **guardarse** antes de que este rank salga |
| `restart_func` | expresión | Se llama cuando los datos deben **restaurarse** después de un reinicio |
| `finalize_func` | expresión | Se llama para hacer **limpieza** antes de que un rank salga |

## Tabla de despacho

| DMRAction | Qué hace `DMR_AUTO` |
|-----------|--------------------|
| `DMR_NO_ACTION` | Nada |
| `DMR_RECONF` | Llama a `dmr_reconfigure()`. Si devuelve `DMR_REDIST_FINALIZE`, llama a `redist_func`, `finalize_func` y después a `dmr_finalize()`; el rank sale |
| `DMR_RESTART_RECONF` | Llama a `restart_func` y después a `dmr_reconfigure()` |
| `DMR_REDIST_FINALIZE` | Llama a `redist_func`, `finalize_func` y después a `dmr_finalize()`; el rank sale |
| `DMR_FINALIZE` | Llama a `finalize_func` y después a `dmr_finalize()`; el rank sale |
| `DMR_CLEANUP` | Llama a `finalize_func` |
| `DMR_ERROR` | No hace nada |

## Ejemplos de uso

```c
// dmr_init: carga el estado si se está reiniciando
DMR_AUTO(dmr_init(argc, argv), (void)NULL, load(), cleanup());

// dmr_check: guarda el estado en los ranks que van a salir
DMR_AUTO(dmr_check(ROUND_POLICY), save(), (void)NULL, cleanup());

// dmr_finalize: solo limpieza
DMR_AUTO(dmr_finalize(), (void)NULL, (void)NULL, cleanup());
```

Pasa `(void)NULL` para cualquier callback que no necesites.

## Implementar los callbacks

### redist_func: guardar el estado antes de salir

Se llama en los ranks que están a punto de salir durante una reconfiguración. Escribe el estado de la aplicación en disco para que la nueva configuración de procesos pueda restaurarlo.

```c
void save(void)
{
    FILE *f = fopen("checkpoint.bin", "wb");
    fwrite(&my_state, sizeof(my_state), 1, f);
    fclose(f);
}
```

Con `DMR_CHECKPOINT_RESTART=0`, envía los datos directamente a través de `DMR_INTERCOMM` en lugar de escribirlos en disco. Consulta [Redistribución de datos](data-redistribution) para más detalles.

### restart_func: restaurar el estado después del reinicio

Se llama en los procesos que reinician tras una reconfiguración. Lee el estado escrito por `redist_func`.

```c
void load(void)
{
    FILE *f = fopen("checkpoint.bin", "rb");
    fread(&my_state, sizeof(my_state), 1, f);
    fclose(f);
}
```

`DMR_AUTO` solo llama a `restart_func` cuando `dmr_init` devuelve `DMR_RESTART_RECONF`, así que no hace falta protegerlo para el primer arranque.

### finalize_func: limpiar recursos

Se llama en cualquier rank que esté a punto de terminar. Libera memoria, cierra descriptores de fichero, etc.

```c
void cleanup(void)
{
    free(my_data);
}
```

## Sin la macro

```c
DMRAction action = dmr_check(ROUND_POLICY);
if (action == DMR_RECONF) {
    if (dmr_reconfigure() == DMR_REDIST_FINALIZE) {
        save();
        cleanup();
        dmr_finalize();
    }
} else if (action == DMR_RESTART_RECONF) {
    load();
    dmr_reconfigure();
}
```
