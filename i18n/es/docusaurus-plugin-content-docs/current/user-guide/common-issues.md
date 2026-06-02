---
sidebar_position: 99
title: Problemas comunes
---

## Expansiones solapadas provocan fallos al lanzar MPI

**Síntoma:** expansiones consecutivas fallan con un error de lanzamiento de MPI o PRRTE.

**Causa:** si `dmr_check(SHOULD_EXPAND)` se vuelve a llamar antes de que la expansión anterior se haya asentado por completo, las dos operaciones MPI spawn pueden interferir entre sí.

**Solución:** añade una pequeña pausa antes de cada llamada a `dmr_check` para dejar que termine la expansión anterior:

```c
sleep(1);
DMR_AUTO(dmr_check(SHOULD_EXPAND), save(), (void)NULL, cleanup());
```

---

## ¿Has lanzado la aplicación con el wrapper de DMR?

**Síntoma:**
```
DMR Error: Could not detect DMR state. Did you launch with the DMR wrapper?
```

**Causa:** la aplicación se lanzó directamente con `mpirun` en lugar de hacerlo mediante `dmr`.

**Solución:** lanza siempre con el wrapper:
```bash
dmr mpirun --host $NODELIST_WITH_COUNTS ./my_app
```

---

## Error al obtener el ID del trabajo de Slurm desde el entorno

**Síntoma:**
```
DMR Error: Issue fetching Slurm job ID info from environment.
```

**Causa:** la aplicación se ejecutó fuera de una asignación de trabajo Slurm, por ejemplo directamente desde la shell. DMR requiere que `SLURM_JOB_ID` esté definido, y eso solo ocurre dentro de un trabajo.

**Solución:** envía el trabajo con `sbatch` o ejecútalo dentro de `salloc`.

---

## Errores de parseo de cgroup.conf en la salida de Slurm

**Síntoma:**
```
slurmstepd: error: Parse error in file /etc/slurm/cgroup.conf line 1: "CgroupPlugin=cgroup/v1"
slurmstepd: fatal: Could not open/read/parse cgroup.conf file
```

**Causa:** ruido de configuración conocido en la imagen Docker de MiniDMR. Estos errores vienen del plugin de cgroups de Slurm, no de DMR.

**Solución:** se pueden ignorar sin problema. No afectan al comportamiento de DMR.
