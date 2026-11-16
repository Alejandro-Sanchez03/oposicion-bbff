// =====================================================================
// Pantalla SEMANA — cargar la guía, ver el reparto y mover tareas.
// =====================================================================
import { datos, guardar, borrar } from '../db.js';
import { hoyISO, textoCorto, rangoFechas, sumarDias } from '../fechas.js';
import { tipoDia, capacidadDia } from '../turnos.js';
import {
  validarGuia, importarGuia, repartirSemana, moverTarea, minutosOcupados,
  semanaDe, ejemploGuia, NOMBRE_TIPO, ICONO_TIPO, instruccionesIA,
} from '../guia.js';
import { ordenarTareasDelDia } from '../reparto.js';
import { esc, dialogo, confirmar, toast, avisar } from '../ui.js';
import { ajustes, cambiarAjustes } from '../ajustes.js';
import { textoCorto as corto } from '../fechas.js';

let semanaVista = null; // id de la semana que se está viendo

export function render(cont, app) {
  const hoy = hoyISO();
  const semanas = [...datos.semanas].sort((a, b) => b.inicio.localeCompare(a.inicio));
  if (!semanas.find((s) => s.id === semanaVista)) {
    semanaVista = (semanaDe(hoy) || semanas.find((s) => s.inicio > hoy) || semanas[0] || {}).id || null;
  }
  const s = semanas.find((x) => x.id === semanaVista);

  cont.innerHTML = `
    <p class="antetitulo">Guía de la academia</p>
    <h1>Semana</h1>
    <label class="subir-pdf">
      <span class="subir-pdf-icono">📄</span>
      <span><b>Subir el PDF de la academia</b><small>La app lo lee y reparte la semana. Gratis y sin internet.</small></span>
      <input type="file" accept="application/pdf,.pdf" data-acc="pdf" hidden>
    </label>
    <details class="otras-formas">
      <summary>Otras formas de cargar la guía</summary>
      <div class="pasos-guia">
        <button class="paso-guia" data-acc="copiar-ia"><b>1</b><span>Copiar instrucciones<br><small>para otra IA, junto al PDF</small></span></button>
        <button class="paso-guia" data-acc="importar"><b>2</b><span>Pegar el JSON<br><small>que te devuelva la IA</small></span></button>
      </div>
    </details>
    <div class="fila-botones">
      ${semanas.length > 1 ? `<select class="selector" data-acc="elegir">
        ${semanas.map((x) => `<option value="${x.id}" ${x.id === semanaVista ? 'selected' : ''}>${esc(x.texto)}</option>`).join('')}
      </select>` : ''}
    </div>
    ${s ? vistaSemana(s, hoy) : '<div class="vacio"><p>Pega aquí la guía de la academia en formato JSON.</p></div>'}`;

  cont.onchange = async (e) => {
    if (e.target.dataset.acc === 'elegir') { semanaVista = e.target.value; app.refrescar(); }
    if (e.target.dataset.acc === 'pdf' && e.target.files[0]) {
      const id = await importarPDF(await e.target.files[0].arrayBuffer());
      e.target.value = '';
      if (id) { semanaVista = id; app.refrescar(); }
    }
  };

  // PDF recibido con "Compartir → Oposición BF" desde otra app (lo guarda sw.js)
  if (location.hash.includes('pdf=compartido')) {
    history.replaceState(null, '', '#/semana');
    caches.open('compartido').then(async (c) => {
      const r = await c.match('pdf-compartido');
      if (!r) return;
      await c.delete('pdf-compartido');
      const id = await importarPDF(await r.arrayBuffer());
      if (id) { semanaVista = id; app.refrescar(); }
    });
  }

  cont.onclick = async (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b || b.tagName === 'SELECT') return;
    const acc = b.dataset.acc;
    const t = datos.tareas.find((x) => x.uid === b.dataset.uid);

    if (acc === 'copiar-ia') {
      const texto = instruccionesIA();
      try {
        await navigator.clipboard.writeText(texto);
        toast('Instrucciones copiadas. Pégalas en la IA y adjunta el PDF.');
      } catch {
        // Si el navegador no deja copiar solo, se muestran para copiarlas a mano.
        await dialogo(`<h3>Instrucciones para la IA</h3><p class="ayuda">Mantén pulsado el texto → Seleccionar todo → Copiar.</p>
          <textarea rows="14" readonly>${esc(texto)}</textarea>`);
      }
    }
    if (acc === 'importar') {
      const id = await dialogoImportar();
      if (id) { semanaVista = id; app.refrescar(); }
    }
    if (acc === 'mover' && t) {
      const nuevo = sumarDias(t.dia_asignado || hoy, Number(b.dataset.dir));
      if (nuevo < s.inicio || nuevo > s.fin) { toast('Fuera de la semana'); return; }
      await moverTarea(t.uid, nuevo);
      app.refrescar();
    }
    if (acc === 'mover-a' && t) {
      const dia = await elegirDia(s, t);
      if (dia !== null) { await moverTarea(t.uid, dia || null); app.refrescar(); }
    }
    if (acc === 'hecha' && t) {
      const hecha = t.estado !== 'hecha';
      await guardar('tareas', { ...t, estado: hecha ? 'hecha' : 'pendiente', hechaEn: hecha ? hoy : null });
      app.refrescar();
    }
    if (acc === 'soltar' && t) {
      await guardar('tareas', { ...t, fijada: false });
      await repartirSemana(s.id);
      app.refrescar();
    }
    if (acc === 'repartir') {
      await repartirSemana(s.id);
      toast('Semana repartida de nuevo');
      app.refrescar();
    }
    if (acc === 'repartir-todo') {
      if (!(await confirmar('Se soltarán también las tareas que moviste a mano y se repartirá todo desde cero. ¿Seguro?', 'Repartir todo'))) return;
      await guardar('tareas', datos.tareas.filter((x) => x.semanaId === s.id && x.fijada && x.tipo !== 'clase')
        .map((x) => ({ ...x, fijada: false })));
      await repartirSemana(s.id);
      app.refrescar();
    }
    if (acc === 'minimos') {
      await guardar('semanas', { ...s, modoMinimos: !s.modoMinimos });
      await repartirSemana(s.id);
      toast(s.modoMinimos ? 'Plan completo' : 'Plan de mínimos aplicado');
      app.refrescar();
    }
    if (acc === 'borrar-semana') {
      if (!(await confirmar(`¿Borrar la semana ${esc(s.texto)} y todas sus tareas?`, 'Borrar'))) return;
      await borrar('tareas', datos.tareas.filter((x) => x.semanaId === s.id).map((x) => x.uid));
      await borrar('semanas', s.id);
      semanaVista = null;
      app.refrescar();
    }
  };
}

function vistaSemana(s, hoy) {
  const tareas = datos.tareas.filter((t) => t.semanaId === s.id);
  const hechas = tareas.filter((t) => t.estado === 'hecha' && t.tipo !== 'clase').length;
  const total = tareas.filter((t) => t.tipo !== 'clase').length;
  const sinDia = tareas.filter((t) => !t.dia_asignado && t.estado !== 'hecha');
  const noCabe = (s.avisos || []).some((a) => a.startsWith('No cabe'));

  return `
    <section class="tarjeta">
      <h2>${esc(s.texto)}</h2>
      <p>Fecha límite: <b>${textoCorto(s.fin)} a las ${s.fecha_limite.slice(11)}</b> · ${hechas}/${total} tareas hechas</p>
      ${s.prioridad.length ? `<p>Prioridad: ${s.prioridad.map((p, i) => `<span class="chip">${i + 1}. ${esc(p)}</span>`).join(' ')}</p>` : ''}
      ${s.plan_minimo ? `<p class="plan-minimo">🎯 Plan de mínimos: ${esc(s.plan_minimo)}</p>` : ''}
      ${s.modoMinimos ? '<p class="aviso info">Estás en <b>modo plan de mínimos</b>: primero las tareas marcadas como mínimas; el resto solo si sobra hueco.</p>' : ''}
      ${(s.avisos || []).map((a) => `<p class="aviso ${a.startsWith('No cabe') || a.startsWith('Ni siquiera') ? 'peligro' : ''}">⚠ ${esc(a)}</p>`).join('')}
      <div class="fila-botones">
        <button class="boton" data-acc="repartir">🔄 Repartir de nuevo</button>
        <button class="boton ${!s.modoMinimos && noCabe ? 'primario' : ''}" data-acc="minimos">${s.modoMinimos ? '↩ Volver al plan completo' : '🎯 Aplicar plan de mínimos'}</button>
      </div>
    </section>

    ${rangoFechas(s.inicio, s.fin).map((f) => vistaDia(f, tareas, s, hoy)).join('')}

    ${sinDia.length ? `<section class="dia sin-hueco"><h3>Sin hueco esta semana (${sinDia.length})</h3>
      ${sinDia.map((t) => filaTarea(t, s)).join('')}</section>` : ''}

    <div class="fila-botones separada">
      <button class="boton pequeno" data-acc="repartir-todo">Soltar lo movido a mano y repartir todo</button>
      <button class="boton pequeno peligro" data-acc="borrar-semana">🗑 Borrar esta semana</button>
    </div>
    <p class="ayuda">Para mover una tarea usa ◀ ▶ (un día antes/después) o «Mover a…». Las tareas que mueves a mano llevan 📌 y el reparto automático ya no las toca.</p>`;
}

function vistaDia(f, tareas, s, hoy) {
  const tipo = tipoDia(f);
  const deDia = ordenarTareasDelDia(tareas.filter((t) => t.dia_asignado === f));
  const ocupado = minutosOcupados(f);
  const cap = capacidadDia(f);
  return `<section class="dia ${f < hoy ? 'pasado' : ''} ${f === hoy ? 'es-hoy' : ''}">
    <h3><span>${textoCorto(f)}${f === hoy ? ' · HOY' : ''}</span>
      <span class="etiqueta-dia mini ${tipo || 'nada'}">${tipo ? tipo.toUpperCase() : 'SIN DEFINIR'}</span>
      <span class="ocupacion ${ocupado > cap ? 'excede' : ''}">${ocupado}/${cap} min</span></h3>
    <div class="barra ${ocupado > cap ? 'excede' : ''}"><div style="width:${Math.min(100, (ocupado / cap) * 100)}%"></div></div>
    ${deDia.length ? deDia.map((t) => filaTarea(t, s)).join('') : '<p class="nada-dia">—</p>'}
  </section>`;
}

function filaTarea(t, s) {
  const hecha = t.estado === 'hecha';
  if (t.tipo === 'clase') return `<div class="fila-tarea clase">🎓 ${esc(t.titulo)} <small>17:00–20:00</small></div>`;
  return `<div class="fila-tarea ${hecha ? 'hecha' : ''}">
    <button class="check-redondo" data-acc="hecha" data-uid="${t.uid}" aria-label="Marcar hecha">${hecha ? '✓' : ''}</button>
    <div class="fila-tarea-texto">
      <div>${ICONO_TIPO[t.tipo]} ${t.fijada ? '📌 ' : ''}${esc(t.titulo)}</div>
      <small>${esc(t.tema)}${NOMBRE_TIPO[t.tipo] !== t.tema ? ` · ${NOMBRE_TIPO[t.tipo]}` : ''} · ${t.minutos} min${t.obligatoria ? '' : ' · opcional'}${t.minimo ? ' · mínimos' : ''}</small>
    </div>
    ${hecha ? '' : `<div class="fila-tarea-botones">
      <button class="boton icono" data-acc="mover" data-dir="-1" data-uid="${t.uid}" aria-label="Un día antes">◀</button>
      <button class="boton icono" data-acc="mover" data-dir="1" data-uid="${t.uid}" aria-label="Un día después">▶</button>
      <button class="boton icono" data-acc="mover-a" data-uid="${t.uid}" aria-label="Mover a…">⋯</button>
      ${t.fijada ? `<button class="boton icono" data-acc="soltar" data-uid="${t.uid}" aria-label="Soltar (que la reparta la app)">📌✕</button>` : ''}
    </div>`}
  </div>`;
}

/** Diálogo para elegir día. Devuelve fecha, '' (= sin día) o null (cancelar). */
function elegirDia(s, t) {
  const dias = rangoFechas(s.inicio, s.fin);
  return dialogo(`<h3>Mover «${esc(t.titulo)}»</h3>
    <div class="lista-dias">${dias.map((f) => {
      const tipo = tipoDia(f);
      return `<label class="opcion-dia"><input type="radio" name="dia" value="${f}" ${f === t.dia_asignado ? 'checked' : ''}>
        ${textoCorto(f)} · ${tipo ? tipo.toUpperCase() : '—'} · ${minutosOcupados(f)}/${capacidadDia(f)} min</label>`;
    }).join('')}
    <label class="opcion-dia"><input type="radio" name="dia" value=""> Sin día (dejar aparte)</label></div>`,
  [{ texto: 'Cancelar', valor: false }, { texto: 'Mover', valor: true, clase: 'primario' }],
  (form, ok) => (ok ? (form.querySelector('input[name=dia]:checked')?.value ?? null) : null));
}

/** Diálogo de importación. Se repite mientras haya errores. Devuelve el id de la semana o null. */
async function dialogoImportar(texto = '', errores = []) {
  const res = await dialogo(`
    <h3>Cargar guía semanal</h3>
    <p class="ayuda">Pega el JSON que te ha generado la IA a partir del PDF de la academia.</p>
    ${errores.length ? `<div class="aviso peligro"><b>Hay ${errores.length} error(es):</b><ul>${errores.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    <textarea name="json" rows="12" spellcheck="false" placeholder='{ "semana": "2026-11-13 a 2026-11-19", ... }'>${esc(texto)}</textarea>`,
  [{ texto: 'Cancelar', valor: 'cancelar' }, { texto: 'Ver ejemplo', valor: 'ejemplo' },
    { texto: '📋 Pegar', valor: 'pegar' }, { texto: 'Importar', valor: 'importar', clase: 'primario' }],
  (form, valor) => ({ valor, texto: form.json.value }));

  if (!res || res.valor === 'cancelar') return null;
  if (res.valor === 'ejemplo') return dialogoImportar(ejemploGuia());
  if (res.valor === 'pegar') {
    let pegado = res.texto;
    try { pegado = await navigator.clipboard.readText(); } catch { toast('No se pudo leer el portapapeles: pega a mano'); }
    // Si la IA lo envolvió en ```json ... ```, se limpia.
    return dialogoImportar(pegado.replace(/^\s*```(json)?/i, '').replace(/```\s*$/, '').trim());
  }
  const { guia, errores: errs } = validarGuia(res.texto);
  if (errs) return dialogoImportar(res.texto, errs);

  return importarValidada(guia);
}

/** Guarda una guía ya comprobada (pregunta si se sustituye y ofrece el plan de mínimos). */
async function importarValidada(guia) {
  const existe = datos.semanas.some((x) => x.id === guia.semana.split(' a ')[0]);
  if (existe && !(await confirmar('Ya tienes cargada esa semana. ¿Sustituirla? (Se conserva lo que ya hayas marcado como hecho.)', 'Sustituir'))) return null;
  const r = await importarGuia(guia);
  toast('Guía cargada y repartida ✔');
  if (r.noCabenObligatorias.length) {
    const sem = datos.semanas.find((x) => x.id === guia.semana.split(' a ')[0]);
    const ok = await confirmar(`⚠ No cabe todo: ${r.noCabenObligatorias.length} tarea(s) obligatoria(s) se quedan sin hueco.<br><br>
      ${sem.plan_minimo ? `La academia propone: <i>${esc(sem.plan_minimo)}</i><br><br>` : ''}¿Aplico el plan de mínimos?`, 'Aplicar plan de mínimos', 'Ahora no');
    if (ok) { await guardar('semanas', { ...sem, modoMinimos: true }); await repartirSemana(sem.id); }
  }
  return guia.semana.split(' a ')[0];
}

// =====================================================================
// Importar desde el PDF de la academia
// =====================================================================
const ICONOS = ICONO_TIPO;

/** Lee el PDF, enseña lo que ha entendido y, si das el visto bueno, lo importa. */
async function importarPDF(buffer) {
  toast('Leyendo el PDF…');
  let r;
  try {
    const { leerTextoPDF, analizarGuia } = await import('../lector-pdf.js');
    r = analizarGuia(await leerTextoPDF(buffer), undefined, ajustes().minutosPDF || undefined);
  } catch (err) {
    console.error(err);
    await avisar(`No he podido abrir el PDF (${esc(err.message)}).`);
    return null;
  }
  if (r.error) {
    await avisar(`${esc(r.error)}<br><br>Puedes usar «Otras formas de cargar la guía» (con otra IA).`);
    return null;
  }
  const g = r.guia;
  const res = await dialogo(`
    <h3>📄 Esto es lo que he entendido</h3>
    <p><b>Semana ${corto(g.semana.slice(0, 10))} – ${corto(g.fecha_limite.slice(0, 10))}</b> · clase el jueves a las ${g.fecha_limite.slice(11)}</p>
    <p class="ayuda">Prioridad: ${g.prioridad.map(esc).join(' › ')}</p>
    <p class="aviso info">⏱ El PDF no dice cuánto dura cada tarea. Ajusta los minutos si hace falta y desmarca lo que no quieras.</p>
    <div class="vista-pdf">${g.tareas.map((t, i) => `
      <label class="fila-pdf ${t.obligatoria ? '' : 'opcional'} ${t.tipo === 'clase' ? 'es-clase' : ''}">
        <input type="checkbox" name="usar${i}" checked>
        <span class="fila-pdf-dia">${corto(t.dia_sugerido)}</span>
        <span class="fila-pdf-titulo">${ICONOS[t.tipo]} ${esc(t.titulo)}
          <small>${t.obligatoria ? 'obligatoria' : 'opcional'}${t.minimo ? ' · mínimos' : ''}</small></span>
        ${t.tipo === 'clase' ? '<span class="fila-pdf-min">—</span>'
          : `<input class="fila-pdf-min" type="number" name="min${i}" min="5" step="5" inputmode="numeric" value="${t.minutos}" aria-label="Minutos">`}
      </label>`).join('')}
    </div>`,
  [{ texto: 'Cancelar', valor: false }, { texto: 'Importar y repartir', valor: true, clase: 'primario' }],
  (form, ok) => {
    if (!ok) return null;
    return g.tareas
      .map((t, i) => ({ ...t, minutos: form[`min${i}`] ? Math.max(5, Number(form[`min${i}`].value) || t.minutos) : t.minutos, usar: form[`usar${i}`].checked }))
      .filter((t) => t.usar)
      .map(({ usar, ...t }) => t);
  });
  if (!res) return null;

  // Recordar los minutos elegidos por tipo para la próxima vez
  const porTipo = { ...(ajustes().minutosPDF || {}) };
  for (const t of res) if (t.tipo !== 'clase') porTipo[t.tipo] = t.minutos;
  await cambiarAjustes({ minutosPDF: porTipo });

  const guia = { ...g, tareas: res };
  const { errores } = validarGuia(JSON.stringify(guia));
  if (errores) { await avisar(`Algo no cuadra: ${errores.map(esc).join('<br>')}`); return null; }
  return importarValidada(guia);
}
