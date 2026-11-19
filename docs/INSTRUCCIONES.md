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

### En el PC (Windows o Mac)
1. Abre **Google Chrome** o **Microsoft Edge** y entra en la misma dirección.
2. En la barra de direcciones, a la derecha, pulsa el icono **Instalar** (un monitor con una flecha)
   → **Instalar**. Se abrirá en su propia ventana y tendrás un acceso directo.
   En pantalla grande verás el menú a la izquierda y la semana entera en columnas.

### Tener los mismos datos en la tablet, el móvil y el PC
La app guarda una copia en un archivo privado de **tu cuenta de GitHub** (un «gist»). Gratis.
1. **Consigue la clave (una sola vez)** desde el PC:
   1. Entra en **github.com/settings/tokens/new**.
   2. En *Note* escribe «Oposición BF» y en *Expiration* elige **No expiration**.
   3. Marca **solo** la casilla **gist** y pulsa **Generate token**.
   4. Copia la clave (empieza por `ghp_`) y **guárdala** en tus notas: GitHub solo la enseña una vez.
2. En el dispositivo donde ya tienes tus datos (la tablet): **Ajustes → Sincronizar entre dispositivos**,
   pega la clave y pulsa **Conectar este dispositivo**.
3. En cada dispositivo nuevo (PC, móvil): al abrir la app por primera vez pulsa
   **«¿Ya usas la app en otro dispositivo?»**, pega la **misma clave** y elige **Usar los de la nube**.
4. Listo: se sincroniza sola al abrir la app, al volver a ella y unos segundos después de cada cambio.
   Sin internet sigue funcionando; se pone al día cuando vuelve la conexión.

> El modo claro/oscuro es de cada dispositivo (puedes tener el PC en oscuro y la tablet en claro).
> Si alguna vez cambias lo mismo en dos dispositivos sin conexión, se queda el cambio más reciente.

## 3. Primeros pasos dentro de la app

1. La primera vez se abre un **asistente** de 4 pasos: fecha del examen (opcional), tu ciclo de turnos
   y cuántos minutos puedes dedicar. Luego podrás corregir días sueltos en **Calendario** tocándolos.
2. **Cada semana, con la guía de la academia (PDF):**
   - En **Semana**, pulsa **«📄 Subir el PDF de la academia»** y elige el PDF.
     O, más rápido: abre el PDF en el móvil → **Compartir → Oposición BF**.
   - La app te enseña lo que ha entendido. Ajusta los **minutos** de cada tarea si hace falta
     (los recuerda para la próxima semana) y pulsa **Importar y repartir**.
   - Si algún día la academia cambia el formato y no lo lee, usa **«Otras formas de cargar la guía»**
     (copiar instrucciones para otra IA y pegar el JSON).
3. **Cada día:** abre la app y pulsa el gran botón **▶ EMPEZAR**. Ya está.
   - Si vas reventado: **⚡ Solo 10 min**.
   - Si hoy es imposible: **🛌 Hoy no puedo** (pasa las tareas a otros días).
   - Al terminar, escribe por dónde vas: lo verás en la nota amarilla «Lo próximo».
   - Al marcar un test como hecho, te pide la nota y la guarda en Progreso.

### Otras cosas útiles
- **Mover tareas**: en **Semana**, arrastra la tarea por el asa **⠿** hasta otro día (o usa ◀ ▶).
- **Vacaciones o baja**: en **Calendario → 🏖️ Vacaciones o baja**, elige las fechas. Esos días no tendrán
  tareas y no romperán la racha. Toca uno de esos días para quitarlo.
- **Resumen de la semana**: el viernes, en **Hoy**, verás cómo fue la semana anterior y podrás
  **pasar lo pendiente** a la semana nueva (entra como opcional: la guía nueva manda).
- **Progreso → Tiempo**: minutos estudiados por día y por semana.
- **Lo atrasado** (Semana → pestaña **📚 Atrasado**):
  - **Subir guías anteriores**: elige a la vez todos los PDF desde que empezaste.
  - Toca **○** en lo que ya tengas estudiado (o «Todo esto ya lo tengo» para una semana entera),
    **➕ Esta semana** para recuperar algo, o **✕** si no lo vas a hacer.
  - **Mi consejo** te dice cuánto te falta y en cuántas semanas lo recuperas. Criterio: primero lo obligatorio
    de la academia de esta semana; después lo obligatorio atrasado (lo más antiguo primero) en tus huecos;
    lo opcional, solo si vas sobrado.
  - Activa **«Recuperar lo obligatorio automáticamente en mis huecos»** y la app lo irá metiendo sola.

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
