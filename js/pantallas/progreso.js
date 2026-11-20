// =====================================================================
// Pantalla PROGRESO — notas de tests (con gráfica) y temario.
// =====================================================================
import { datos, guardar, borrar, nuevoId } from '../db.js';
import { ajustes } from '../ajustes.js';
import { hoyISO, textoCorto, sumarDias, inicioSemanaAcademia, rangoFechas, deISO } from '../fechas.js';
import { minutosDelDia, rachaActual, mejorRacha } from '../racha.js';
import { esc, confirmar, dialogo, toast, avisar } from '../ui.js';
import { semanaDe, repartirSemana } from '../guia.js';
import { dialogoNota, calcularNota } from '../notas.js';
import { normalizar, grupoPara, notasDe, resumenNotas, temasFlojos } from '../temario.js';

export { calcularNota };

let pestana = 'estudio';
let temaGrafica = '__todos';
const gruposAbiertos = new Set(); // grupos del temario desplegados

// Colores de las líneas de la gráfica (uno fijo por tema, siempre en el mismo orden).
const COLORES = ['--serie-1', '--serie-2', '--serie-3', '--serie-4', '--serie-5', '--serie-6', '--serie-7', '--serie-8'];

/** Temas que aparecen en tests, en orden de aparición (así cada tema conserva su color). */
function temasDeTests() {
  const lista = [];
  [...datos.tests].sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((t) => {
    if (!lista.includes(t.tema)) lista.push(t.tema);
  });
  return lista;
}

export function render(cont, app) {
  if (pestana === 'tests') pestana = 'temario';
  cont.innerHTML = `
    <p class="antetitulo">Tiempo, temario y notas</p>
    <h1>Progreso</h1>
    <div class="pestanas">
      <button class="pestana ${pestana === 'estudio' ? 'activa' : ''}" data-pest="estudio">⏱️ Tiempo</button>
      <button class="pestana ${pestana === 'temario' ? 'activa' : ''}" data-pest="temario">📚 Temario y notas</button>
    </div>
    <div id="contenido-progreso"></div>`;
  const zona = cont.querySelector('#contenido-progreso');
  if (pestana === 'estudio') renderEstudio(zona); else renderTemario(zona, app);

  cont.querySelectorAll('[data-pest]').forEach((b) => b.addEventListener('click', () => {
    pestana = b.dataset.pest; app.refrescar();
  }));
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
  zona.querySelectorAll('.grafica-envoltorio').forEach(activarTooltipEn);
}
function activarTooltipEn(env) {
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

// ---------------------------------------------------------------- TIEMPO ESTUDIADO
const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`);

function renderEstudio(zona) {
  const hoy = hoyISO();
  const a = ajustes();
  // Últimos 14 días
  const dias = rangoFechas(sumarDias(hoy, -13), hoy).map((f) => ({ f, min: minutosDelDia(f) }));
  // Últimas 8 semanas de academia (viernes a jueves)
  const vierneActual = inicioSemanaAcademia(hoy);
  const semanas = Array.from({ length: 8 }, (_, i) => sumarDias(vierneActual, -7 * (7 - i))).map((v) => ({
    f: v, min: rangoFechas(v, sumarDias(v, 6)).reduce((s, f) => s + minutosDelDia(f), 0),
  }));
  const estaSemana = semanas[semanas.length - 1].min;
  const total = datos.sesiones.reduce((s, x) => s + x.minutos, 0);
  const media14 = Math.round(dias.reduce((s, d) => s + d.min, 0) / 14);

  zona.innerHTML = `
    <section class="cifras">
      <div class="cifra"><b>${hm(estaSemana)}</b><small>esta semana</small></div>
      <div class="cifra"><b>${hm(media14)}</b><small>media diaria (14 días)</small></div>
      <div class="cifra"><b>${hm(total)}</b><small>en total</small></div>
      <div class="cifra"><b>🔥 ${rachaActual()}</b><small>racha · mejor ${mejorRacha()}</small></div>
    </section>
    <section class="tarjeta">
      <h3>Últimos 14 días</h3>
      <div class="grafica-envoltorio">${barras(dias.map((d) => ({
        valor: d.min, etiqueta: String(deISO(d.f).getDate()), info: `${textoCorto(d.f)} · ${hm(d.min)}`, destacar: d.f === hoy,
      })), { linea: a.minimoMinutos, textoLinea: `mínimo ${a.minimoMinutos} min`, unidad: 'min' })}</div>
    </section>
    <section class="tarjeta">
      <h3>Por semanas (de viernes a jueves)</h3>
      <div class="grafica-envoltorio">${barras(semanas.map((w, i) => ({
        valor: Math.round((w.min / 60) * 10) / 10, etiqueta: i === semanas.length - 1 ? 'Esta' : textoCorto(w.f).split(' ')[1],
        info: `Semana del ${textoCorto(w.f)} · ${hm(w.min)}`, destacar: i === semanas.length - 1, mostrarValor: true,
      })), { unidad: 'h' })}</div>
    </section>`;
  activarTooltip(zona);
}

/** Gráfica de barras sencilla en SVG (una sola serie). */
function barras(datosBarras, { linea = null, textoLinea = '', unidad = '' } = {}) {
  const W = 640, H = 220, M = { i: 36, d: 10, a: 18, b: 26 };
  // Escala "redonda": marcas de 1, 2 o 5 × 10^n (p. ej. 0, 10, 20, 30)
  const bruto = Math.max(unidad === 'h' ? 1 : 10, linea || 0, ...datosBarras.map((d) => d.valor));
  const potencia = 10 ** Math.floor(Math.log10(bruto / 3));
  const paso = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p * 3 >= bruto) || potencia * 10;
  const max = paso * Math.ceil(bruto / paso);
  const marcas = Math.round(max / paso);
  const ancho = (W - M.i - M.d) / datosBarras.length;
  const y = (v) => M.a + (1 - v / max) * (H - M.a - M.b);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="grafica" role="img" aria-label="Gráfica de barras">`;
  // Rejilla: 3 líneas
  for (let k = 0; k <= marcas; k++) {
    const v = paso * k;
    svg += `<line x1="${M.i}" x2="${W - M.d}" y1="${y(v)}" y2="${y(v)}" class="rejilla"/>
      <text x="${M.i - 6}" y="${y(v) + 4}" class="eje" text-anchor="end">${String(Math.round(v * 10) / 10).replace('.', ',')}</text>`;
  }
  datosBarras.forEach((d, i) => {
    const x = M.i + i * ancho + ancho * 0.18;
    const w = ancho * 0.64;
    const alto = Math.max(d.valor > 0 ? 3 : 0, H - M.b - y(d.valor));
    svg += `<rect x="${x}" y="${H - M.b - alto}" width="${w}" height="${alto}" rx="4" class="barra-dato ${d.destacar ? 'destacada' : ''}"/>
      <text x="${x + w / 2}" y="${H - 8}" class="eje" text-anchor="middle">${d.etiqueta}</text>
      ${d.mostrarValor && d.valor > 0 ? `<text x="${x + w / 2}" y="${H - M.b - alto - 5}" class="eje valor" text-anchor="middle">${String(d.valor).replace('.', ',')}</text>` : ''}
      <rect x="${M.i + i * ancho}" y="${M.a}" width="${ancho}" height="${H - M.a - M.b}" fill="transparent" class="zona-toque" data-info="${esc(d.info)}"/>`;
  });
  if (linea) {
    svg += `<line x1="${M.i}" x2="${W - M.d}" y1="${y(linea)}" y2="${y(linea)}" class="aprobado"/>
      <text x="${M.i + 6}" y="${y(linea) - 5}" class="eje" text-anchor="start">${esc(textoLinea)}</text>`;
  }
  return `${svg}</svg><div class="tooltip" hidden></div>`;
}

// ---------------------------------------------------------------- TEMARIO Y NOTAS
const ESTADOS = [
  ['pendiente', 'Pendiente'],
  ['estudiado', 'Estudiado'],
  ['repasado', 'Repasado'],
];
const coma = (n) => n.toFixed(1).replace('.', ',');
const claseNota = (n) => (n >= 7 ? 'bien' : n >= 5 ? 'regular' : 'mal');

/** Chip con la última nota de un tema (y si sube o baja). */
function chipNota(nombre) {
  const r = resumenNotas(nombre);
  if (!r) return '';
  const flecha = r.tendencia === 'sube' ? ' ▲' : r.tendencia === 'baja' ? ' ▼' : '';
  return `<span class="chip-nota ${claseNota(r.ultima)}" title="Última nota ${coma(r.ultima)} · media ${coma(r.media)} (${r.n} test${r.n > 1 ? 's' : ''})">${coma(r.ultima)}${flecha}</span>`;
}

function renderTemario(zona, app) {
  const temas = [...datos.temas].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const n = temas.length || 1;
  const est = temas.filter((t) => t.estado !== 'pendiente').length;
  const rep = temas.filter((t) => t.estado === 'repasado').length;
  const grupos = [...new Set(temas.map((t) => t.grupo))];
  const flojos = temasFlojos();
  const tests = [...datos.tests].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || '').localeCompare(a.creado || ''));
  const temasT = temasDeTests();

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

    <div class="acciones-temario">
      <label class="boton primario">📄 Añadir temas desde un PDF<input type="file" accept="application/pdf,.pdf" data-acc="pdf-indice" hidden></label>
      <button class="boton" data-acc="nota">✍️ Apuntar nota de un test</button>
      <button class="boton" data-acc="nuevo-tema">+ Tema</button>
    </div>
    <p class="ayuda">Los temas de las guías se añaden solos y su estado sube solo cuando haces sus tareas
      (puedes cambiarlo tú). Toca un tema para ver sus notas. Con el PDF de un documento (PEIF, decretos, fichas…)
      la app saca su índice para que elijas los apartados.</p>

    ${flojos.length ? `<section class="tarjeta reforzar">
      <h3>⚠️ Para reforzar</h3>
      <p class="ayuda">Temas con la última nota por debajo de 5 o la media por debajo de 6.</p>
      ${flojos.map((f) => `<div class="fila-flojo">
        <span><b>${esc(f.nombre)}</b><small>última ${coma(f.ultima)} · media ${coma(f.media)} · ${f.n} test${f.n > 1 ? 's' : ''}</small></span>
        <button class="boton pequeno" data-acc="reforzar" data-tema="${esc(f.nombre)}">➕ Repaso esta semana</button>
      </div>`).join('')}
    </section>` : ''}

    ${grupos.map((g) => {
      const delGrupo = temas.filter((t) => t.grupo === g);
      const hechos = delGrupo.filter((t) => t.estado !== 'pendiente').length;
      const notasMal = delGrupo.some((t) => { const r = resumenNotas(t.nombre); return r && (r.ultima < 5 || r.media < 6); });
      return `<details class="tarjeta grupo-temario" data-grupo="${esc(g)}" ${gruposAbiertos.has(g) ? 'open' : ''}>
      <summary><span class="grupo-nombre">${esc(g)}${notasMal ? ' <span class="chip-nota mal">⚠</span>' : ''}</span>
        <span class="grupo-progreso"><b>${hechos}/${delGrupo.length}</b>
          <span class="mini-barra"><i style="width:${(hechos / delGrupo.length) * 100}%"></i></span></span></summary>
      ${delGrupo.map((t) => `
        <div class="fila-tema">
          <button class="nombre-tema" data-acc="detalle" data-id="${t.id}">${esc(t.nombre)} ${chipNota(t.nombre)}</button>
          <div class="segmentado">
            ${ESTADOS.map(([v, txt]) => `<button class="${t.estado === v ? 'activo ' + v : ''}" data-id="${t.id}" data-estado="${v}">${txt}</button>`).join('')}
          </div>
        </div>`).join('')}</details>`;
    }).join('')}

    <details class="tarjeta historial" ${tests.length ? '' : 'hidden'}>
      <summary><b>📈 Historial de notas (${tests.length})</b></summary>
      ${tests.length ? `
        <select class="selector" data-acc="tema-grafica">
          <option value="__todos">Todos los temas</option>
          ${temasT.map((t) => `<option ${t === temaGrafica ? 'selected' : ''}>${esc(t)}</option>`).join('')}
        </select>
        <div class="grafica-envoltorio">${grafica(temasT)}</div>
        <table class="tabla">
          <thead><tr><th>Fecha</th><th>Tema</th><th>✓</th><th>✗</th><th>–</th><th>Nota</th><th></th></tr></thead>
          <tbody>${tests.map((t) => `<tr>
            <td>${textoCorto(t.fecha)}</td><td>${esc(t.tema)}</td><td>${t.aciertos}</td><td>${t.fallos}</td>
            <td>${t.blanco}</td><td><b>${t.nota.toFixed(2)}</b></td>
            <td><button class="boton icono" data-acc="borrar-test" data-id="${t.id}" aria-label="Borrar">🗑</button></td></tr>`).join('')}
          </tbody></table>` : ''}
    </details>`;

  zona.querySelector('[data-acc=tema-grafica]')?.addEventListener('change', (e) => {
    temaGrafica = e.target.value; app.refrescar();
  });
  zona.querySelector('[data-acc=pdf-indice]').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) { await temasDesdePDF(f); app.refrescar(); }
  });
  activarTooltip(zona);
  zona.querySelectorAll('.grupo-temario').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) gruposAbiertos.add(d.dataset.grupo); else gruposAbiertos.delete(d.dataset.grupo);
  }));

  zona.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.estado) {
      const t = datos.temas.find((x) => x.id === b.dataset.id);
      await guardar('temas', { ...t, estado: b.dataset.estado });
      app.refrescar();
    }
    const acc = b.dataset.acc;
    if (acc === 'nota') { if (await dialogoNota()) app.refrescar(); }
    if (acc === 'detalle') { await detalleTema(b.dataset.id); app.refrescar(); }
    if (acc === 'reforzar') await reforzar(b.dataset.tema);
    if (acc === 'borrar-test') {
      if (await confirmar('¿Borrar esta nota?', 'Borrar')) { await borrar('tests', b.dataset.id); app.refrescar(); }
    }
    if (acc === 'nuevo-tema') {
      const r = await dialogo(`<h3>Nuevo tema</h3>
        <label class="campo"><span>Nombre</span><input name="nombre" placeholder="Ej: Ley de Montes"></label>
        <label class="campo"><span>Grupo</span><input name="grupo" list="lista-grupos" placeholder="Ej: Legislación"></label>
        <datalist id="lista-grupos">${grupos.map((g) => `<option value="${esc(g)}">`).join('')}</datalist>`,
      [{ texto: 'Cancelar', valor: false }, { texto: 'Añadir', valor: true, clase: 'primario' }],
      (form, ok) => (ok ? { nombre: form.nombre.value.trim(), grupo: form.grupo.value.trim() } : null));
      if (r && r.nombre) {
        const orden = Math.max(0, ...datos.temas.map((t) => t.orden || 0)) + 1;
        await guardar('temas', { id: nuevoId(), nombre: r.nombre, grupo: r.grupo || grupoPara(r.nombre), estado: 'pendiente', orden, origen: 'manual' });
        app.refrescar();
      }
    }
  };
}

/** Ficha de un tema: sus notas, sus tareas, cambiar nombre/grupo o borrarlo. */
async function detalleTema(id) {
  const t = datos.temas.find((x) => x.id === id);
  if (!t) return;
  const notas = notasDe(t.nombre);
  const tareas = datos.tareas.filter((x) => normalizar(x.tema) === normalizar(t.nombre) && x.tipo !== 'clase');
  const hechas = tareas.filter((x) => x.estado === 'hecha').length;
  const r = resumenNotas(t.nombre);
  const res = await dialogo(`
    <h3>${esc(t.nombre)}</h3>
    <div class="cifras">
      <div class="cifra"><b>${r ? coma(r.ultima) : '—'}</b><small>última nota</small></div>
      <div class="cifra"><b>${r ? coma(r.media) : '—'}</b><small>media (${notas.length} test${notas.length === 1 ? '' : 's'})</small></div>
      <div class="cifra"><b>${hechas}/${tareas.length}</b><small>tareas de las guías</small></div>
    </div>
    ${notas.length ? `<div class="lista-notas">${notas.slice().reverse().map((x) =>
      `<span class="chip-nota ${claseNota(x.nota)}">${textoCorto(x.fecha)} · ${coma(x.nota)}</span>`).join('')}</div>` : '<p class="ayuda">Aún no hay notas de este tema.</p>'}
    <div class="dos-columnas">
      <label class="campo"><span>Nombre</span><input name="nombre" value="${esc(t.nombre)}"></label>
      <label class="campo"><span>Grupo</span><input name="grupo" value="${esc(t.grupo)}"></label>
    </div>`,
  [{ texto: '🗑 Borrar tema', valor: 'borrar', clase: 'peligro' }, { texto: '✍️ Apuntar nota', valor: 'nota' }, { texto: 'Guardar', valor: 'guardar', clase: 'primario' }],
  (form, v) => ({ v, nombre: form.nombre.value.trim(), grupo: form.grupo.value.trim() }));
  if (!res || !res.v) return;
  if (res.v === 'borrar') {
    if (await confirmar(`¿Borrar el tema «${esc(t.nombre)}» del temario? (Sus notas se conservan.)`, 'Borrar')) await borrar('temas', t.id);
    return;
  }
  if (res.v === 'nota') { await dialogoNota({ tema: t.nombre }); return; }
  if (res.nombre && (res.nombre !== t.nombre || res.grupo !== t.grupo)) {
    // Si cambias el nombre, las notas antiguas pasan al nombre nuevo
    if (res.nombre !== t.nombre) {
      await guardar('tests', datos.tests.filter((x) => normalizar(x.tema) === normalizar(t.nombre)).map((x) => ({ ...x, tema: res.nombre })));
    }
    await guardar('temas', { ...t, nombre: res.nombre, grupo: res.grupo || t.grupo });
  }
}

/** Añade un repaso del tema flojo a la semana actual. */
async function reforzar(tema) {
  const semana = semanaDe(hoyISO());
  if (!semana) { avisar('Carga primero la guía de esta semana.'); return; }
  const uid = `${semana.id}_refuerzo_${normalizar(tema).replace(/\s+/g, '-')}`;
  if (datos.tareas.some((t) => t.uid === uid && t.estado !== 'hecha')) { toast('Ya tienes ese repaso esta semana'); return; }
  const orden = Math.max(0, ...datos.tareas.filter((t) => t.semanaId === semana.id).map((t) => t.orden)) + 1;
  await guardar('tareas', {
    uid, semanaId: semana.id, id: `refuerzo_${orden}`, titulo: `Repaso ${tema} (reforzar)`, tema, tipo: 'repaso',
    obligatoria: false, minimo: false, minutos: 30, dia_sugerido: null, dia_asignado: null, fijada: false,
    estado: 'pendiente', hechaEn: null, minutosDedicados: 0, recolocadaDesde: null, orden, rescate: true,
  });
  const r = await repartirSemana(semana.id, [uid]);
  toast(r.asignacion[uid] ? `Repaso añadido el ${textoCorto(r.asignacion[uid])} 📅` : 'Añadido, pero esta semana no queda hueco (mira «Sin hueco» en Semana)');
}

/** Lee el índice de un PDF y deja elegir qué apartados añadir al temario. */
async function temasDesdePDF(archivo) {
  toast('Leyendo el índice del PDF…');
  let r;
  try {
    const { leerIndicePDF } = await import('../lector-pdf.js');
    r = await leerIndicePDF(await archivo.arrayBuffer(), archivo.name);
  } catch (err) {
    await avisar(`No he podido abrir el PDF (${esc(err.message)}).`);
    return;
  }
  if (!r.entradas.length) {
    await avisar('No he encontrado un índice en este PDF (ni marcadores ni títulos numerados). Puedes añadir los temas a mano con «+ Tema».');
    return;
  }
  const niveles1 = r.entradas.filter((e) => e.nivel === 1).length;
  const marcarNivel = niveles1 >= 3 ? 1 : 2; // por defecto: los apartados principales
  const res = await dialogo(`
    <h3>📄 Índice encontrado</h3>
    <p class="ayuda">${r.fuente === 'marcadores' ? 'Sacado de los marcadores del PDF.' : 'Sacado de los títulos numerados del documento.'}
      Marca los apartados que quieras en tu temario.</p>
    <label class="campo"><span>Grupo (nombre del documento)</span><input name="grupo" value="${esc(r.titulo)}"></label>
    <div class="fila-botones"><button type="button" class="boton pequeno" data-marcar="todo">Marcar todo</button>
      <button type="button" class="boton pequeno" data-marcar="nada">Ninguno</button></div>
    <div class="vista-pdf indice">${r.entradas.map((e, i) => `
      <label class="fila-indice nivel-${Math.min(e.nivel, 3)}">
        <input type="checkbox" name="e${i}" ${e.nivel <= marcarNivel ? 'checked' : ''}>
        <span>${esc(e.texto)}</span>
      </label>`).join('')}</div>`,
  [{ texto: 'Cancelar', valor: false }, { texto: 'Añadir al temario', valor: true, clase: 'primario' }],
  (form, ok) => (ok ? { grupo: form.grupo.value.trim() || r.titulo || 'Documento', elegidas: r.entradas.filter((_, i) => form[`e${i}`].checked) } : null),
  (d) => d.querySelectorAll('[data-marcar]').forEach((b) => b.addEventListener('click', () => {
    d.querySelectorAll('.fila-indice input').forEach((c) => { c.checked = b.dataset.marcar === 'todo'; });
  })));
  if (!res || !res.elegidas.length) return;
  const existentes = new Set(datos.temas.filter((t) => normalizar(t.grupo) === normalizar(res.grupo)).map((t) => normalizar(t.nombre)));
  let orden = Math.max(0, ...datos.temas.map((t) => t.orden || 0)) + 1;
  const nuevos = res.elegidas.filter((e) => !existentes.has(normalizar(e.texto)))
    .map((e, i) => ({ id: nuevoId() + i, nombre: e.texto, grupo: res.grupo, estado: 'pendiente', orden: orden++, origen: 'pdf' }));
  await guardar('temas', nuevos);
  toast(`${nuevos.length} apartado(s) añadidos a «${res.grupo}»`);
}
