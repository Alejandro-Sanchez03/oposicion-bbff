// =====================================================================
// Pantalla PROGRESO — notas de tests (con gráfica) y temario.
// =====================================================================
import { datos, guardar, borrar, nuevoId } from '../db.js';
import { ajustes } from '../ajustes.js';
import { hoyISO, textoCorto } from '../fechas.js';
import { esc, confirmar, dialogo, toast } from '../ui.js';

let pestana = 'tests';
let temaGrafica = '__todos';

// Colores de las líneas de la gráfica (uno fijo por tema, siempre en el mismo orden).
const COLORES = ['--serie-1', '--serie-2', '--serie-3', '--serie-4', '--serie-5', '--serie-6', '--serie-7', '--serie-8'];

/** Nota sobre 10 con penalización: (aciertos − fallos/N) / total × 10. */
export function calcularNota(aciertos, fallos, blanco, penalizacion = ajustes().penalizacion) {
  const total = aciertos + fallos + blanco;
  if (!total) return 0;
  const netos = aciertos - (penalizacion > 0 ? fallos / penalizacion : 0);
  return Math.max(0, Math.round((netos / total) * 1000) / 100);
}

/** Temas que aparecen en tests, en orden de aparición (así cada tema conserva su color). */
function temasDeTests() {
  const lista = [];
  [...datos.tests].sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((t) => {
    if (!lista.includes(t.tema)) lista.push(t.tema);
  });
  return lista;
}

export function render(cont, app) {
  cont.innerHTML = `
    <h1>Progreso</h1>
    <div class="pestanas">
      <button class="pestana ${pestana === 'tests' ? 'activa' : ''}" data-pest="tests">📝 Tests</button>
      <button class="pestana ${pestana === 'temario' ? 'activa' : ''}" data-pest="temario">📚 Temario</button>
    </div>
    <div id="contenido-progreso"></div>`;
  const zona = cont.querySelector('#contenido-progreso');
  if (pestana === 'tests') renderTests(zona, app); else renderTemario(zona, app);

  cont.querySelectorAll('[data-pest]').forEach((b) => b.addEventListener('click', () => {
    pestana = b.dataset.pest; app.refrescar();
  }));
}

// ---------------------------------------------------------------- TESTS
function renderTests(zona, app) {
  const temasSugeridos = [...new Set([...datos.temas.map((t) => t.nombre), ...datos.tests.map((t) => t.tema),
    ...datos.tareas.map((t) => t.tema)])];
  const tests = [...datos.tests].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado));
  const temas = temasDeTests();

  zona.innerHTML = `
    <form class="tarjeta form-test">
      <h3>Apuntar un test</h3>
      <div class="dos-columnas">
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${hoyISO()}" required></label>
        <label class="campo"><span>Tema</span><input name="tema" list="lista-temas" required placeholder="PEIF · Apartado 4"></label>
      </div>
      <datalist id="lista-temas">${temasSugeridos.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
      <div class="tres-columnas">
        <label class="campo"><span>Aciertos</span><input type="number" name="aciertos" min="0" inputmode="numeric" required></label>
        <label class="campo"><span>Fallos</span><input type="number" name="fallos" min="0" inputmode="numeric" value="0"></label>
        <label class="campo"><span>En blanco</span><input type="number" name="blanco" min="0" inputmode="numeric" value="0"></label>
      </div>
      <label class="campo"><span>Nota (sobre 10) — se calcula sola${ajustes().penalizacion ? `, cada ${ajustes().penalizacion} fallos restan 1 acierto` : ''}; puedes cambiarla</span>
        <input type="number" name="nota" step="0.01" min="0" max="10" inputmode="decimal"></label>
      <button class="boton primario ancho">Guardar test</button>
    </form>

    ${tests.length ? `
      <section class="tarjeta">
        <h3>Evolución de la nota</h3>
        <select class="selector" data-acc="tema-grafica">
          <option value="__todos">Todos los temas</option>
          ${temas.map((t) => `<option ${t === temaGrafica ? 'selected' : ''}>${esc(t)}</option>`).join('')}
        </select>
        <div class="grafica-envoltorio">${grafica(temas)}</div>
      </section>
      <section class="tarjeta">
        <h3>Tests apuntados (${tests.length})</h3>
        <table class="tabla">
          <thead><tr><th>Fecha</th><th>Tema</th><th>✓</th><th>✗</th><th>–</th><th>Nota</th><th></th></tr></thead>
          <tbody>${tests.map((t) => `<tr>
            <td>${textoCorto(t.fecha)}</td><td>${esc(t.tema)}</td><td>${t.aciertos}</td><td>${t.fallos}</td>
            <td>${t.blanco}</td><td><b>${t.nota.toFixed(2)}</b></td>
            <td><button class="boton icono" data-borrar="${t.id}" aria-label="Borrar">🗑</button></td></tr>`).join('')}
          </tbody></table>
      </section>` : '<p class="vacio">Aún no has apuntado ningún test.</p>'}`;

  const form = zona.querySelector('.form-test');
  const recalcular = () => {
    const n = (k) => Number(form[k].value) || 0;
    if (form.aciertos.value !== '') form.nota.value = calcularNota(n('aciertos'), n('fallos'), n('blanco')).toFixed(2);
  };
  ['aciertos', 'fallos', 'blanco'].forEach((k) => form[k].addEventListener('input', recalcular));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = (k) => Number(form[k].value) || 0;
    const nota = form.nota.value !== '' ? Math.min(10, Math.max(0, Number(form.nota.value)))
      : calcularNota(n('aciertos'), n('fallos'), n('blanco'));
    await guardar('tests', {
      id: nuevoId(), fecha: form.fecha.value, tema: form.tema.value.trim(),
      aciertos: n('aciertos'), fallos: n('fallos'), blanco: n('blanco'), nota, creado: new Date().toISOString(),
    });
    toast(`Test guardado: ${nota.toFixed(2)}`);
    app.refrescar();
  });

  zona.querySelector('[data-acc=tema-grafica]')?.addEventListener('change', (e) => {
    temaGrafica = e.target.value; app.refrescar();
  });
  zona.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    if (await confirmar('¿Borrar este test?', 'Borrar')) { await borrar('tests', b.dataset.borrar); app.refrescar(); }
  }));
  activarTooltip(zona);
}

/** Gráfica de líneas en SVG: nota (0–10) de cada test, una línea por tema. */
function grafica(temas) {
  const mostrar = temaGrafica === '__todos' ? temas : temas.filter((t) => t === temaGrafica);
  const tests = [...datos.tests].filter((t) => mostrar.includes(t.tema)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!tests.length) return '<p>Sin datos.</p>';
  const fechas = [...new Set(tests.map((t) => t.fecha))];
  const W = 640, H = 260, M = { i: 34, d: 14, a: 12, b: 30 };
  const x = (f) => M.i + (fechas.length === 1 ? (W - M.i - M.d) / 2 : (fechas.indexOf(f) / (fechas.length - 1)) * (W - M.i - M.d));
  const y = (n) => M.a + (1 - n / 10) * (H - M.a - M.b);

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="grafica" role="img" aria-label="Evolución de la nota por tema">`;
  for (let n = 0; n <= 10; n += 2) {
    svg += `<line x1="${M.i}" x2="${W - M.d}" y1="${y(n)}" y2="${y(n)}" class="rejilla"/>
      <text x="${M.i - 8}" y="${y(n) + 4}" class="eje" text-anchor="end">${n}</text>`;
  }
  svg += `<line x1="${M.i}" x2="${W - M.d}" y1="${y(5)}" y2="${y(5)}" class="aprobado"/>`;
  // Etiquetas de fecha (como mucho 6, repartidas)
  const paso = Math.max(1, Math.ceil(fechas.length / 6));
  fechas.forEach((f, i) => {
    if (i % paso === 0 || i === fechas.length - 1) svg += `<text x="${x(f)}" y="${H - 8}" class="eje" text-anchor="middle">${textoCorto(f)}</text>`;
  });
  for (const tema of mostrar) {
    const color = `var(${COLORES[temas.indexOf(tema) % COLORES.length]})`;
    const puntos = tests.filter((t) => t.tema === tema);
    if (puntos.length > 1) {
      svg += `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
        points="${puntos.map((t) => `${x(t.fecha)},${y(t.nota)}`).join(' ')}"/>`;
    }
    puntos.forEach((t) => {
      svg += `<circle cx="${x(t.fecha)}" cy="${y(t.nota)}" r="5" fill="${color}" class="punto"/>
        <circle cx="${x(t.fecha)}" cy="${y(t.nota)}" r="16" fill="transparent" class="zona-toque"
          data-info="${esc(`${tema} · ${textoCorto(t.fecha)} · ${t.nota.toFixed(2)}`)}"/>`;
    });
  }
  svg += '</svg>';
  const leyenda = mostrar.length > 1 ? `<div class="leyenda-grafica">${mostrar.map((t) =>
    `<span><i style="background:var(${COLORES[temas.indexOf(t) % COLORES.length]})"></i>${esc(t)}</span>`).join('')}</div>` : '';
  return svg + leyenda + '<div class="tooltip" hidden></div>';
}

/** Al tocar (o pasar por encima de) un punto, muestra tema, fecha y nota. */
function activarTooltip(zona) {
  const env = zona.querySelector('.grafica-envoltorio');
  if (!env) return;
  const tip = env.querySelector('.tooltip');
  const mostrar = (e) => {
    const p = e.target.closest('.zona-toque');
    if (!p) { tip.hidden = true; return; }
    tip.textContent = p.dataset.info;
    const r = env.getBoundingClientRect(), pr = p.getBoundingClientRect();
    tip.style.left = `${Math.min(r.width - 160, Math.max(0, pr.left - r.left - 60))}px`;
    tip.style.top = `${pr.top - r.top - 34}px`;
    tip.hidden = false;
  };
  env.addEventListener('pointerover', mostrar);
  env.addEventListener('click', mostrar);
}

// ---------------------------------------------------------------- TEMARIO
const ESTADOS = [
  ['pendiente', 'Pendiente'],
  ['estudiado', 'Estudiado'],
  ['repasado', 'Repasado'],
];

function renderTemario(zona, app) {
  const temas = [...datos.temas].sort((a, b) => a.orden - b.orden);
  const n = temas.length || 1;
  const est = temas.filter((t) => t.estado !== 'pendiente').length;
  const rep = temas.filter((t) => t.estado === 'repasado').length;
  const grupos = [...new Set(temas.map((t) => t.grupo))];

  zona.innerHTML = `
    <section class="tarjeta">
      <h3>¿Cuánto te falta?</h3>
      <p>Estudiados: <b>${est}/${temas.length}</b> · Repasados: <b>${rep}/${temas.length}</b> · Pendientes: <b>${temas.length - est}</b></p>
      <div class="barra doble" role="img" aria-label="${est} de ${temas.length} estudiados, ${rep} repasados">
        <div class="repasado" style="width:${(rep / n) * 100}%"></div>
        <div class="estudiado" style="width:${((est - rep) / n) * 100}%"></div>
      </div>
      <p class="leyenda"><span class="punto-leyenda repasado"></span> repasado
        <span class="punto-leyenda estudiado"></span> estudiado <span class="punto-leyenda pendiente"></span> pendiente</p>
    </section>
    ${grupos.map((g) => `<section class="tarjeta"><h3>${esc(g)}</h3>
      ${temas.filter((t) => t.grupo === g).map((t) => `
        <div class="fila-tema">
          <span class="nombre-tema">${esc(t.nombre)}</span>
          <div class="segmentado">
            ${ESTADOS.map(([v, txt]) => `<button class="${t.estado === v ? 'activo ' + v : ''}" data-tema="${t.id}" data-estado="${v}">${txt}</button>`).join('')}
          </div>
          <button class="boton icono" data-borrar-tema="${t.id}" aria-label="Borrar tema">🗑</button>
        </div>`).join('')}</section>`).join('')}
    <button class="boton primario ancho" data-acc="nuevo-tema">+ Añadir tema</button>`;

  zona.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tema) {
      const t = datos.temas.find((x) => x.id === b.dataset.tema);
      await guardar('temas', { ...t, estado: b.dataset.estado });
      app.refrescar();
    }
    if (b.dataset.borrarTema) {
      const t = datos.temas.find((x) => x.id === b.dataset.borrarTema);
      if (await confirmar(`¿Borrar el tema «${esc(t.nombre)}»?`, 'Borrar')) { await borrar('temas', t.id); app.refrescar(); }
    }
    if (b.dataset.acc === 'nuevo-tema') {
      const r = await dialogo(`<h3>Nuevo tema</h3>
        <label class="campo"><span>Nombre</span><input name="nombre" placeholder="Ej: Ley de Montes"></label>
        <label class="campo"><span>Grupo</span><input name="grupo" list="lista-grupos" placeholder="Ej: Legislación"></label>
        <datalist id="lista-grupos">${grupos.map((g) => `<option value="${esc(g)}">`).join('')}</datalist>`,
      [{ texto: 'Cancelar', valor: false }, { texto: 'Añadir', valor: true, clase: 'primario' }],
      (form, ok) => (ok ? { nombre: form.nombre.value.trim(), grupo: form.grupo.value.trim() || 'Otros' } : null));
      if (r && r.nombre) {
        const orden = Math.max(0, ...datos.temas.map((t) => t.orden)) + 1;
        await guardar('temas', { id: nuevoId(), nombre: r.nombre, grupo: r.grupo, estado: 'pendiente', orden });
        app.refrescar();
      }
    }
  };
}
