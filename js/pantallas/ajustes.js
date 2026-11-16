// =====================================================================
// Pantalla AJUSTES — tiempos, aspecto, copia de seguridad.
// =====================================================================
import { ajustes, cambiarAjustes, aplicarTema } from '../ajustes.js';
import { exportarTodo, importarTodo, borrarTodo, datos } from '../db.js';
import { hoyISO } from '../fechas.js';
import { repartirSemana } from '../guia.js';
import { confirmar, avisar, toast, dialogo, esc } from '../ui.js';
import { configSync, conectar, desconectar, usarDatosDeLaNube } from '../sync.js';

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
    <p class="antetitulo">A tu medida</p>
    <h1>Ajustes</h1>
    <form class="tarjeta" id="form-ajustes">
      <h3>Tiempos</h3>
      ${NUMEROS.map(([k, txt, min, max]) => `<label class="campo fila"><span>${txt}</span>
        <input type="number" name="${k}" min="${min}" max="${max}" inputmode="numeric" value="${a[k]}"></label>`).join('')}
      <p class="ayuda">El mínimo diario se cumple con los minutos <b>o</b> con las tareas, lo que llegue antes.</p>
      <button class="boton primario ancho">Guardar</button>
    </form>

    <section class="tarjeta">
      <h3>Fecha del examen</h3>
      <p class="ayuda">Para la cuenta atrás de la pantalla HOY. Déjala vacía si aún no se sabe.</p>
      <div class="fila-botones">
        <input type="date" id="fecha-examen" value="${a.fechaExamen || ''}">
      </div>
    </section>

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

    ${seccionSync()}

    <section class="tarjeta">
      <h3>Copia de seguridad</h3>
      <p>${a.ultimaCopia ? `Última copia: <b>${a.ultimaCopia}</b>` : '<b>Aún no has hecho ninguna copia.</b>'}</p>
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

  cont.querySelector('#fecha-examen').addEventListener('change', async (e) => {
    await cambiarAjustes({ fechaExamen: e.target.value || null });
    toast('Fecha del examen guardada');
  });

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
    if (b.dataset.acc === 'sync-conectar') await accionConectar(cont, app);
    if (b.dataset.acc === 'sync-ahora') {
      b.disabled = true; b.textContent = 'Sincronizando…';
      await app.sincronizarAhora();
      app.refrescar();
    }
    if (b.dataset.acc === 'sync-desconectar') {
      if (await confirmar('Este dispositivo dejará de sincronizarse (sus datos se quedan aquí). ¿Seguir?', 'Desconectar')) {
        desconectar(); app.refrescar();
      }
    }
    if (b.dataset.tema) { await cambiarAjustes({ tema: b.dataset.tema }); aplicarTema(); app.refrescar(); }
    if (b.dataset.acc === 'exportar') { await exportar(); app.refrescar(); }
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

/** Descarga la copia de seguridad (también se usa desde la pantalla HOY). */
export async function exportar() {
  const blob = new Blob([JSON.stringify(exportarTodo(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oposicion-copia-${hoyISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  await cambiarAjustes({ ultimaCopia: hoyISO() });
  toast('Copia descargada (mírala en Descargas)');
}

// ---------------------------------------------------------------- SINCRONIZACIÓN
function haceCuanto(iso) {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} días`;
}

function seccionSync() {
  const cfg = configSync();
  if (cfg) {
    return `<section class="tarjeta sync">
      <h3>🔄 Sincronizar entre dispositivos</h3>
      <p class="sync-estado ${cfg.error ? 'error' : 'ok'}">${cfg.error ? `⚠ ${esc(cfg.error)}` : '✓ Conectado'}
        <small>Cuenta de GitHub: <b>${esc(cfg.usuario || '')}</b> · última sincronización: ${haceCuanto(cfg.ultima)}</small></p>
      <p class="ayuda">Se sincroniza sola al abrir la app, al volver a ella y a los pocos segundos de cada cambio
        (cuando hay internet). Conecta los demás dispositivos con la <b>misma clave</b>.</p>
      <div class="fila-botones">
        <button class="boton primario" data-acc="sync-ahora">🔄 Sincronizar ahora</button>
        <button class="boton pequeno" data-acc="sync-desconectar">Desconectar este dispositivo</button>
      </div>
    </section>`;
  }
  return `<section class="tarjeta sync">
    <h3>🔄 Sincronizar entre dispositivos</h3>
    <p>Para usar la app en la tablet, el móvil y el PC con los <b>mismos datos</b>. Es gratis: los datos se guardan
      en un archivo privado (un «gist») de <b>tu cuenta de GitHub</b>.</p>
    <details class="pasos-sync"><summary>Cómo conseguir la clave (solo una vez, 2 minutos)</summary>
      <ol>
        <li>Entra en <b>github.com</b> con tu cuenta (mejor desde el PC).</li>
        <li>Abre <b>github.com/settings/tokens/new</b> <small>(Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic))</small>.</li>
        <li>En <b>Note</b> escribe «Oposición BF». En <b>Expiration</b> elige <b>No expiration</b>.</li>
        <li>Marca <b>solo</b> la casilla <b>gist</b>. Nada más.</li>
        <li>Abajo, <b>Generate token</b>. Copia la clave (empieza por <code>ghp_</code>).
          <small>GitHub solo la enseña una vez: guárdala en un sitio seguro (por ejemplo, en tus notas).</small></li>
        <li>Pégala aquí abajo. Haz lo mismo en cada dispositivo, con la <b>misma clave</b>.</li>
      </ol>
    </details>
    <label class="campo"><span>Clave de GitHub</span>
      <input id="token-sync" type="password" autocomplete="off" placeholder="ghp_…" spellcheck="false"></label>
    <button class="boton primario ancho" data-acc="sync-conectar">Conectar este dispositivo</button>
    <p class="ayuda">La clave solo sirve para leer y escribir tus gists, y se queda guardada en este dispositivo.</p>
  </section>`;
}

async function accionConectar(cont, app) {
  const token = cont.querySelector('#token-sync').value.trim();
  if (!token) { toast('Pega primero la clave de GitHub'); return; }
  if (!navigator.onLine) { avisar('Necesitas conexión a internet para conectar.'); return; }
  try {
    toast('Conectando con GitHub…');
    const r = await conectar(token);
    if (r.hayDatosRemotos) {
      // Ya hay datos de otro dispositivo: ¿usar esos o combinar?
      const tieneDatos = datos.semanas.length || datos.sesiones.length || datos.tests.length;
      const eleccion = await dialogo(`<h3>Ya hay datos en la nube</h3>
        <p>Encontré los datos de otro dispositivo.</p>
        <p>${tieneDatos ? 'Este dispositivo también tiene datos propios. ' : ''}¿Qué hago?</p>`,
      [
        { texto: 'Combinar los dos', valor: 'combinar' },
        { texto: 'Usar los de la nube', valor: 'nube', clase: 'primario' },
      ]);
      if (eleccion === 'nube') await usarDatosDeLaNube();
      await app.sincronizarAhora();
      toast('✓ Dispositivo conectado y sincronizado');
      setTimeout(() => location.reload(), 900);
      return;
    }
    toast('✓ Conectado. Tus datos ya están en la nube.');
    app.refrescar();
  } catch (e) {
    desconectar();
    avisar(`No se pudo conectar: ${esc(e.message)}`);
  }
}
