# Prueba del reparto: semana con 4 días de TURNO y 3 LIBRES

Generado con `node tests/probar-reparto.mjs`. Turno = 45 min, libre = 210 min (y una segunda prueba con libres de solo 120 min para forzar el aviso de "no cabe" y el plan de mínimos).

```

=== Reparto normal (turno 45 min, libre 210 min) ===

Vie 20  LIBRE  210/210 min
   - Estudiar apartado 5 PEIF (estudio, 120 min) [sugerido Vie 20]
   - Estudiar Documento IV PEIF (estudio, 90 min, mínimos) [sugerido Dom 22]

Sáb 21  TURNO  30/45 min
   - Test apartado 5 PEIF (test, 30 min, mínimos) [sugerido Sáb 21]

Dom 22  TURNO  45/45 min
   - Aptitud numérica 02 (psicotecnico, 45 min, opcional) [sugerido Sáb 21]

Lun 23  TURNO  20/45 min
   - Autoevaluación Documento IV (autoevaluacion, 20 min, mínimos) [sugerido Lun 23]

Mar 24  TURNO  25/45 min
   - Repaso Anexo 2 (repaso, 25 min, mínimos) [sugerido Mar 24]

Mié 25  LIBRE  210/210 min
   - Estudiar arts. 1-20 Reglamento SBF (estudio, 120 min) [sugerido Lun 23]
   - Test arts. 1-20 Reglamento (test, 30 min) [sugerido Mar 24]
   - Fichas PE: espumógenos (estudio, 60 min, opcional) [sugerido Mié 25]

Jue 26  LIBRE  40/210 min
   - Razonamiento abstracto 03 (psicotecnico, 40 min, opcional) [sugerido Mié 25]
   - Clase semanal (clase, 0 min) [sugerido Jue 26]

✅ Orden lógico y capacidades correctos

=== Semana apretada (libres de solo 120 min) ===

Vie 20  LIBRE  120/120 min
   - Estudiar apartado 5 PEIF (estudio, 120 min) [sugerido Vie 20]

Sáb 21  TURNO  30/45 min
   - Test apartado 5 PEIF (test, 30 min, mínimos) [sugerido Sáb 21]

Dom 22  TURNO  45/45 min
   - Aptitud numérica 02 (psicotecnico, 45 min, opcional) [sugerido Sáb 21]

Lun 23  TURNO  40/45 min
   - Razonamiento abstracto 03 (psicotecnico, 40 min, opcional) [sugerido Mié 25]

Mar 24  TURNO  25/45 min
   - Repaso Anexo 2 (repaso, 25 min, mínimos) [sugerido Mar 24]

Mié 25  LIBRE  110/120 min
   - Estudiar Documento IV PEIF (estudio, 90 min, mínimos) [sugerido Dom 22]
   - Autoevaluación Documento IV (autoevaluacion, 20 min, mínimos) [sugerido Lun 23]

Jue 26  LIBRE  120/120 min
   - Estudiar arts. 1-20 Reglamento SBF (estudio, 120 min) [sugerido Lun 23]
   - Clase semanal (clase, 0 min) [sugerido Jue 26]

SIN HUECO: Test arts. 1-20 Reglamento, Fichas PE: espumógenos
AVISO: No cabe todo: 1 tarea(s) obligatoria(s) sin hueco (30 min). Te propongo aplicar el plan de mínimos de la academia.

=== Misma semana con PLAN DE MÍNIMOS ===

Vie 20  LIBRE  120/120 min
   - Estudiar apartado 5 PEIF (estudio, 120 min) [sugerido Vie 20]

Sáb 21  TURNO  30/45 min
   - Test apartado 5 PEIF (test, 30 min, mínimos) [sugerido Sáb 21]

Dom 22  TURNO  45/45 min
   - Aptitud numérica 02 (psicotecnico, 45 min, opcional) [sugerido Sáb 21]

Lun 23  TURNO  40/45 min
   - Razonamiento abstracto 03 (psicotecnico, 40 min, opcional) [sugerido Mié 25]

Mar 24  TURNO  25/45 min
   - Repaso Anexo 2 (repaso, 25 min, mínimos) [sugerido Mar 24]

Mié 25  LIBRE  110/120 min
   - Estudiar Documento IV PEIF (estudio, 90 min, mínimos) [sugerido Dom 22]
   - Autoevaluación Documento IV (autoevaluacion, 20 min, mínimos) [sugerido Lun 23]

Jue 26  LIBRE  120/120 min
   - Estudiar arts. 1-20 Reglamento SBF (estudio, 120 min) [sugerido Lun 23]
   - Clase semanal (clase, 0 min) [sugerido Jue 26]

SIN HUECO: Test arts. 1-20 Reglamento, Fichas PE: espumógenos
AVISO: No cabe todo: 1 tarea(s) obligatoria(s) sin hueco (30 min).

✅ Orden lógico y capacidades correctos
```
