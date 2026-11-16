# Oposición BF — organizador de estudio

App web para organizar el estudio de la oposición de **Bombero Forestal (Comunitat Valenciana)**
trabajando a turnos. Se abre en **HOY** y te dice exactamente qué toca.

- Funciona **sin internet** una vez instalada.
- **Sin cuentas ni servidor**: los datos se guardan solo en tu dispositivo.
- Instalable en Android (tablet y móvil) como si fuera una app.

👉 **Instrucciones de instalación y actualización:** [docs/INSTRUCCIONES.md](docs/INSTRUCCIONES.md)

## Estructura del código

| Archivo | Qué hace |
|---|---|
| `index.html` | Esqueleto de la página y barra de navegación |
| `css/estilos.css` | Aspecto (colores claro/oscuro arriba del todo) |
| `js/app.js` | Arranque y navegación entre pantallas |
| `js/db.js` | Guardar/leer datos en el dispositivo (IndexedDB) y copias de seguridad |
| `js/ajustes.js` | Valores por defecto y temario inicial |
| `js/fechas.js` | Utilidades de fechas |
| `js/turnos.js` | Saber si un día es TURNO o LIBRE (patrón + correcciones) |
| `js/reparto.js` | **El algoritmo de reparto** de tareas (reglas explicadas al principio) |
| `js/guia.js` | Importar y validar la guía JSON, recolocar tareas atrasadas |
| `js/racha.js` | Mínimo diario, racha y comodines |
| `js/frases.js` + `frases.json` | Frase motivadora del día (edita `frases.json` para añadir/quitar) |
| `js/temporizador.js` | Temporizador pomodoro (se recupera si se cierra la app) |
| `js/bienvenida.js` | Asistente de la primera vez |
| `fuentes/` | Tipografías incluidas (Bricolage Grotesque e Inter, licencia OFL) |
| `js/pantallas/*.js` | Una archivo por pantalla: hoy, semana, calendario, progreso, ajustes |
| `sw.js` | Funcionamiento sin conexión (⚠ sube `VERSION` al publicar cambios) |
| `tests/probar-reparto.mjs` | Prueba del reparto: `node tests/probar-reparto.mjs` |
| `tests/guia-ejemplo.json` | Guía de ejemplo para probar la importación |

## Formato de la guía semanal

```json
{
  "semana": "2026-11-13 a 2026-11-19",
  "fecha_limite": "2026-11-19T17:00",
  "prioridad": ["PEIF", "Psicotécnico"],
  "plan_minimo": "Si vas agobiado, céntrate solo en el Documento IV y el Anexo 2",
  "tareas": [
    {"id": "t1", "titulo": "Estudiar apartado 4 PEIF", "tema": "PEIF", "tipo": "estudio",
     "obligatoria": true, "dia_sugerido": "2026-11-13", "minutos": 120, "minimo": false}
  ]
}
```

`tipo`: `estudio`, `test`, `autoevaluacion`, `repaso`, `psicotecnico`, `clase`.
