# Instrucciones (sin necesidad de saber programar)

## 1. Publicar la app en internet (solo una vez)

La app se publica gratis con **GitHub Pages**. Desde el ordenador o desde el navegador del móvil:

1. Entra en tu repositorio: `github.com/alejandro-sanchez03/oposicion-bbff`.
2. **Hazlo público** (GitHub Pages gratis solo funciona con repositorios públicos;
   tus datos de estudio NO están en el repositorio, solo el código):
   **Settings → General →** abajo del todo, *Danger Zone* → **Change visibility → Make public**.
3. Ve a **Settings → Pages**.
4. En *Build and deployment → Source* elige **Deploy from a branch**.
5. En *Branch* elige la rama `main` (o, para probar antes de fusionar, la rama
   `claude/oposiciones-study-app-orng78`), carpeta **/ (root)**, y pulsa **Save**.
6. Espera 1–2 minutos y recarga la página. Arriba saldrá:
   *"Your site is live at* **https://alejandro-sanchez03.github.io/oposicion-bbff/**"*.
   Esa es la dirección de tu app.

## 2. Instalarla en la tablet o el móvil Android

1. Abre **Google Chrome** en la tablet.
2. Escribe la dirección: `https://alejandro-sanchez03.github.io/oposicion-bbff/`
3. Espera a que cargue del todo (con internet, solo esta primera vez).
4. Toca el menú **⋮** (arriba a la derecha) → **Instalar aplicación**
   (o **Añadir a pantalla de inicio** → **Instalar**).
5. Aparecerá el icono naranja con una llama: **Oposición BF**. Ábrela siempre desde ahí.
6. Prueba: activa el **modo avión** y ábrela. Debe funcionar igual.

Repite en el móvil si quieres tenerla también allí.

> ⚠ **Tablet y móvil NO se sincronizan solos** (no hay servidor). Usa uno como principal.
> Para pasar los datos de uno a otro: en el principal **Ajustes → Exportar copia**,
> envíate el archivo (WhatsApp, correo, Drive…) y en el otro **Ajustes → Importar copia**.

## 3. Primeros pasos dentro de la app

1. **Calendario → Definir patrón**: pon el primer día de turno del ciclo y cuántos días de turno
   y libres tienes. Luego toca los días sueltos que no encajen para cambiarlos (TURNO ↔ LIBRE).
2. **Semana → Cargar guía (JSON)**: pega el JSON que te genera la IA. Si tiene errores te dirá cuáles.
   Pulsa **Ver ejemplo** para ver cómo debe ser.
3. **Hoy**: abre la app cada día y haz lo que pone. Pulsa **▶ EMPEZAR** y, al terminar,
   escribe por dónde vas.
4. **Ajustes**: cambia los minutos por día, el pomodoro y el mínimo diario a tu gusto.

## 4. Copias de seguridad

Los datos viven solo en el dispositivo. Si borras los datos de Chrome o desinstalas la app,
**se pierden**. Haz **Ajustes → Exportar copia** cada semana (por ejemplo, el jueves después de clase)
y guarda el archivo en Drive o envíatelo.

## 5. Cómo actualizar la app cuando haya cambios

- **En el dispositivo no tienes que hacer nada especial**: cuando abras la app con internet
  y haya una versión nueva, aparecerá arriba **"Hay una versión nueva — Actualizar"**. Tócalo.
  Tus datos se mantienen.
- Si alguna vez no aparece: cierra la app del todo (quítala de recientes) y vuelve a abrirla con internet.

**Si cambias tú algo del código** (por ejemplo, frases en `frases.json`):

1. En GitHub, abre el archivo, pulsa el lápiz ✏️, cambia lo que quieras y **Commit changes**.
2. Abre también `sw.js` y sube el número de `VERSION` (p. ej. `'1.0.0'` → `'1.0.1'`),
   y lo mismo en `js/app.js` (`window.VERSION_APP`). **Sin este paso los dispositivos no ven el cambio.**
3. Espera 1–2 minutos y abre la app con internet: saldrá el botón **Actualizar**.
