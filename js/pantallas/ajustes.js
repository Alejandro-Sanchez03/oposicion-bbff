// =====================================================================
// Pantalla AJUSTES — tiempos, aspecto, copia de seguridad.
// =====================================================================
import { ajustes, cambiarAjustes, aplicarTema } from '../ajustes.js';
import { exportarTodo, importarTodo, borrarTodo, datos } from '../db.js';
import { hoyISO } from '../fechas.js';
import { repartirSemana } from '../guia.js';
import { confirmar, avisar, toast } from '../ui.js';

// [campo, etiqueta, mínimo, máximo]
const NUMEROS = [
  ['minutosTurno', 'Máximo de tareas en día de TURNO (min)', 0, 600],
  ['minutosLibre', 'Máximo de tareas en día LIBRE (min)', 0, 900],
  ['pomodoroEstudio', 'Bloque de estudio del temporizador (min)', 1, 120],
  ['pomodoroDescanso', 'Descanso del temporizador (min)', 1, 60],
  ['minimoMinutos', 'Mínimo diario: minutos', 1, 600],
  ['minimoTareas', 'Mínimo diario: o tareas hechas', 1, 20],
  ['penalizacion', 'Tests: cada cuántos fallos se resta 1 acierto (0 = no resta)', 0, 10],
];

export function render(cont, app) {
  const a = ajustes();
  cont.innerHTML = `
    <h1>Ajustes</h1>
    <form class="tarjeta" id="form-ajustes">
      <h3>Tiempos</h3>
      ${NUMEROS.map(([k, txt, min, max]) => `<label class="campo fila"><span>${txt}</span>
        <input type="number" name="${k}" min="${min}" max="${max}" inputmode="numeric" value="${a[k]}"></label>`).join('')}
      <p class="ayuda">El mínimo diario se cumple con los minutos <b>o</b> con las tareas, lo que llegue antes.</p>
      <button class="boton primario ancho">Guardar</button>
    </form>

    <section class="tarjeta">
      <h3>Aspecto</h3>
      <div class="segmentado ancho">
        ${[['auto', '🌓 Automático'], ['claro', '☀️ Claro'], ['oscuro', '🌙 Oscuro']].map(([v, t]) =>
          `<button class="${a.tema === v ? 'activo' : ''}" data-tema="${v}">${t}</button>`).join('')}
      </div>
    </section>

    <section class="tarjeta">
      <h3>Notificación de la mañana</h3>
      <p class="ayuda">Pendiente (fase 4): primero tienes que elegir cómo se envían las notificaciones.</p>
    </section>

    <section class="tarjeta">
      <h3>Copia de seguridad</h3>
      <p class="ayuda">Tus datos solo están en este dispositivo. Haz una copia de vez en cuando
        (y siempre antes de cambiar de móvil o borrar datos del navegador).</p>
      <div class="fila-botones">
        <button class="boton primario" data-acc="exportar">⬇ Exportar copia</button>
        <label class="boton">⬆ Importar copia<input type="file" accept=".json,application/json" data-acc="importar" hidden></label>
      </div>
      <button class="boton peligro pequeno separada" data-acc="borrar">🗑 Borrar todos los datos</button>
    </section>
    <p class="ayuda centrado">Oposición BF · versión <span id="version-app"></span></p>`;

  cont.querySelector('#version-app').textContent = window.VERSION_APP || '';

  cont.querySelector('#form-ajustes').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const cambios = {};
    for (const [k, , min, max] of NUMEROS) {
      const v = Number(f[k].value);
      cambios[k] = Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : a[k];
    }
    await cambiarAjustes(cambios);
    // Los límites de minutos afectan al reparto: se reparte de nuevo la semana en curso.
    for (const s of datos.semanas.filter((x) => x.fin >= hoyISO())) await repartirSemana(s.id);
    toast('Ajustes guardados');
    app.refrescar();
  });

  cont.onclick = async (e) => {
    const b = e.target.closest('[data-tema], [data-acc]');
    if (!b) return;
    if (b.dataset.tema) { await cambiarAjustes({ tema: b.dataset.tema }); aplicarTema(); app.refrescar(); }
    if (b.dataset.acc === 'exportar') exportar();
    if (b.dataset.acc === 'borrar') {
      if (await confirmar('Se borrará TODO (turnos, guías, racha, tests, temario). ¿Has hecho una copia?', 'Borrar todo') &&
          await confirmar('¿Seguro de verdad? No se puede deshacer.', 'Sí, borrar')) {
        await borrarTodo();
        location.reload();
      }
    }
  };

  cont.querySelector('[data-acc=importar]').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const copia = JSON.parse(await archivo.text());
      if (!(await confirmar('Esto SUSTITUYE todos los datos actuales por los de la copia. ¿Seguir?', 'Importar'))) return;
      await importarTodo(copia);
      toast('Copia restaurada');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      avisar(`No se pudo importar: ${err.message}`);
    }
  });
}

function exportar() {
  const blob = new Blob([JSON.stringify(exportarTodo(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oposicion-copia-${hoyISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Copia descargada (mírala en Descargas)');
}
