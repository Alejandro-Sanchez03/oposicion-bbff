// =====================================================================
// Pestaña ATRASADO (dentro de Semana): lo que quedó sin hacer en semanas
// anteriores, para marcar lo que ya tienes y recuperar el resto.
// =====================================================================
import { datos, guardar } from '../db.js';
import { ajustes, cambiarAjustes } from '../ajustes.js';
import { hoyISO, textoCorto } from '../fechas.js';
import { NOMBRE_TIPO, ICONO_TIPO, validarGuia, importarGuia, semanaDe } from '../guia.js';
import {
  atrasadas, copiaActiva, recuperarEstaSemana, yaLoTengo, descartar, consejo, actualizarRecuperacion,
} from '../atrasado.js';
import { esc, dialogo, confirmar, toast, avisar, celebrar } from '../ui.js';

const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);
const fechaCorta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Bloque "Mi consejo" con los números de lo atrasado. */
function bloqueConsejo() {
  const c = consejo();
  const actual = semanaDe(hoyISO());
  if (!c.total) {
    return `<section class="consejo ok"><b>✅ Vas al día</b>
      <p>No tienes nada atrasado. Sigue con la planificación de la academia.</p></section>`;
  }
  let texto;
  if (!c.obl) {
    texto = `<p>Lo que tienes atrasado es <b>opcional</b> (${horas(c.minOpc)}). <b>Sigue con la academia</b> y
      recupéralo solo cuando vayas sobrado.</p>`;
  } else {
    const ritmo = c.hueco == null ? ''
      : c.hueco === 0 ? `<p>⚠ Esta semana la guía no te deja hueco libre. Si quieres recuperar, aplica el
          <b>plan de mínimos</b> de la academia alguna semana para liberar tiempo.</p>`
      : `<p>Con tus turnos, una semana como esta te deja unas <b>${horas(c.hueco)}</b> libres después de lo obligatorio
          de la academia. A ese ritmo lo recuperas en <b>${c.semanasNecesarias === 1 ? '1 semana' : `unas ${c.semanasNecesarias} semanas`}</b>.</p>
        <p>${c.restante ? `Lo que queda de esta semana tiene <b>${horas(c.restante)}</b> libres.`
          : 'Lo que queda de esta semana ya está lleno: lo atrasado entrará en la semana que viene.'}</p>`;
    texto = `<p>Tienes <b>${c.obl} tarea${c.obl > 1 ? 's' : ''} obligatoria${c.obl > 1 ? 's' : ''}</b> sin hacer
        (${horas(c.minObl)})${c.opc ? ` y ${c.opc} opcional${c.opc > 1 ? 'es' : ''}` : ''}.</p>
      <p><b>No dejes la planificación de la academia</b>: es la que marca las clases y el test del jueves.
        Recupera lo obligatorio atrasado <b>en tus huecos</b>, empezando por lo más antiguo
        (va antes que lo opcional de esta semana). Lo opcional atrasado, solo si vas sobrado.</p>
      ${ritmo}`;
  }
  return `<section class="consejo"><b>💡 Mi consejo</b>${texto}
    ${c.obl ? `<label class="interruptor">
      <input type="checkbox" data-acc="auto" ${ajustes().recuperarAuto ? 'checked' : ''} ${actual ? '' : 'disabled'}>
      <span><b>Recuperar lo obligatorio automáticamente en mis huecos</b>
        <small>${actual ? 'La app lo mete en los días con tiempo libre de esta semana.' : 'Carga la guía de esta semana para activarlo.'}</small></span>
    </label>` : ''}
  </section>`;
}

function filaAtrasada(t) {
  const copia = copiaActiva(t.uid);
  const estadoCopia = copia
    ? `<span class="chip recuperando">📅 ${copia.dia_asignado ? `Recuperando el ${textoCorto(copia.dia_asignado)}` : 'Esta semana, sin hueco'}</span>`
    : `<button class="boton pequeno" data-acc="recuperar" data-uid="${t.uid}">➕ Esta semana</button>`;
  return `<div class="fila-atrasada ${t.estado === 'descartada' ? 'descartada' : ''}">
    ${t.estado === 'descartada' ? '' : `<button class="check-redondo" data-acc="tengo" data-uid="${t.uid}" aria-label="Ya lo tengo" title="Ya lo tengo"></button>`}
    <div class="fila-tarea-texto">
      <div>${ICONO_TIPO[t.tipo]} ${esc(t.titulo)}</div>
      <small>${esc(t.tema)}${NOMBRE_TIPO[t.tipo] !== t.tema ? ` · ${NOMBRE_TIPO[t.tipo]}` : ''} · ${t.minutos} min ·
        ${t.obligatoria ? '<b>obligatoria</b>' : 'opcional'}</small>
    </div>
    <div class="fila-atrasada-acciones">
      ${t.estado === 'descartada'
        ? `<button class="boton pequeno" data-acc="reponer" data-uid="${t.uid}">↩ Volver a poner</button>`
        : `${estadoCopia}<button class="boton icono" data-acc="descartar" data-uid="${t.uid}" aria-label="No lo voy a hacer" title="No lo voy a hacer">✕</button>`}
    </div>
  </div>`;
}

export function renderAtrasado(cont, app, cabecera) {
  const lista = atrasadas();
  const descartadas = atrasadas({ incluirDescartadas: true }).filter((t) => t.estado === 'descartada');
  // Agrupar por semana (la más antigua primero: es el orden en que conviene recuperarlo)
  const porSemana = new Map();
  [...lista].sort((a, b) => a.semanaId.localeCompare(b.semanaId) || a.orden - b.orden)
    .forEach((t) => { if (!porSemana.has(t.semanaId)) porSemana.set(t.semanaId, []); porSemana.get(t.semanaId).push(t); });

  cont.innerHTML = `${cabecera}
    ${bloqueConsejo()}
    <label class="boton ancho subir-varias">📚 Subir guías anteriores (puedes elegir varios PDF a la vez)
      <input type="file" accept="application/pdf,.pdf" multiple data-acc="pdfs" hidden></label>
    <p class="ayuda">Toca <b>○</b> en lo que <b>ya tengas estudiado</b>. Lo demás puedes recuperarlo
      (<b>➕ Esta semana</b>) o descartarlo (<b>✕</b>).</p>
    ${[...porSemana.entries()].map(([semanaId, tareas]) => {
      const s = datos.semanas.find((x) => x.id === semanaId);
      return `<section class="dia">
        <h3><span>Semana del ${fechaCorta(s.inicio)} al ${fechaCorta(s.fin)}</span>
          <span class="ocupacion">${tareas.length} sin hacer</span></h3>
        ${tareas.map(filaAtrasada).join('')}
        <div class="fila-botones"><button class="boton pequeno" data-acc="tengo-semana" data-semana="${semanaId}">✓ Todo esto ya lo tengo</button></div>
      </section>`;
    }).join('')}
    ${descartadas.length ? `<details class="otras-formas"><summary>Descartadas (${descartadas.length})</summary>
      ${descartadas.map(filaAtrasada).join('')}</details>` : ''}`;

  cont.onchange = async (e) => {
    const acc = e.target.dataset.acc;
    if (acc === 'auto') {
      await cambiarAjustes({ recuperarAuto: e.target.checked });
      await actualizarRecuperacion({ completo: true });
      toast(e.target.checked ? 'Lo obligatorio atrasado irá a tus huecos libres' : 'Recuperación automática desactivada');
      app.refrescar();
    }
    if (acc === 'pdfs' && e.target.files.length) {
      await importarVarios([...e.target.files]);
      e.target.value = '';
      app.refrescar();
    }
  };

  cont.onclick = async (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b || b.tagName === 'INPUT') return;
    const acc = b.dataset.acc;
    const uid = b.dataset.uid;
    if (acc === 'tengo') { celebrar(b); await yaLoTengo([uid]); await actualizarRecuperacion(); app.refrescar(); }
    if (acc === 'tengo-semana') {
      const uids = lista.filter((t) => t.semanaId === b.dataset.semana).map((t) => t.uid);
      if (await confirmar(`¿Marcar como estudiadas las ${uids.length} tareas de esa semana?`, 'Sí, ya las tengo')) {
        await yaLoTengo(uids); await actualizarRecuperacion(); celebrar(); app.refrescar();
      }
    }
    if (acc === 'recuperar') {
      const r = await recuperarEstaSemana([uid]);
      if (!r.ok) { avisar(r.motivo); return; }
      toast(r.colocadas ? 'Añadida a esta semana 📅' : 'Añadida, pero esta semana no le queda hueco (mira «Sin hueco»)');
      app.refrescar();
    }
    if (acc === 'descartar') { await descartar(uid, true); await actualizarRecuperacion(); toast('Descartada'); app.refrescar(); }
    if (acc === 'reponer') { await descartar(uid, false); app.refrescar(); }
  };
}

/** Importa varios PDF de golpe (guías anteriores). */
async function importarVarios(archivos) {
  toast(`Leyendo ${archivos.length} PDF…`);
  const { leerTextoPDF, analizarGuia } = await import('../lector-pdf.js');
  const resultados = [];
  for (const f of archivos) {
    try {
      const r = analizarGuia(await leerTextoPDF(await f.arrayBuffer()), undefined, ajustes().minutosPDF || undefined);
      resultados.push({ nombre: f.name, ...r });
    } catch (err) {
      resultados.push({ nombre: f.name, error: `no se pudo abrir (${err.message})` });
    }
  }
  const validos = resultados.filter((r) => r.guia).sort((a, b) => a.guia.semana.localeCompare(b.guia.semana));
  const ids = new Set();
  const res = await dialogo(`<h3>📚 Guías encontradas</h3>
    <div class="vista-pdf">${validos.map((r, i) => {
      const id = r.guia.semana.slice(0, 10);
      const repetida = ids.has(id); ids.add(id);
      const yaEsta = datos.semanas.some((s) => s.id === id);
      const obl = r.guia.tareas.filter((t) => t.obligatoria && t.tipo !== 'clase').length;
      return `<label class="fila-pdf ${yaEsta || repetida ? 'opcional' : ''}" style="grid-template-columns: 26px 1fr">
        <input type="checkbox" name="g${i}" ${yaEsta || repetida ? '' : 'checked'}>
        <span class="fila-pdf-titulo">Semana del ${fechaCorta(r.guia.semana.slice(0, 10))} al ${fechaCorta(r.guia.semana.slice(13))}
          <small>${obl} obligatorias · ${r.guia.tareas.length} tareas · ${esc(r.nombre)}${yaEsta ? ' · <b>ya cargada</b> (se sustituiría)' : ''}${repetida ? ' · repetida' : ''}</small></span>
      </label>`;
    }).join('') || '<p>No he reconocido ninguna guía.</p>'}</div>
    ${resultados.filter((r) => r.error).map((r) => `<p class="aviso peligro">${esc(r.nombre)}: ${esc(r.error)}</p>`).join('')}
    <p class="ayuda">Los minutos se ponen con los valores de siempre; puedes cambiarlos después en cada semana.</p>`,
  [{ texto: 'Cancelar', valor: false }, { texto: 'Importar las marcadas', valor: true, clase: 'primario' }],
  (form, ok) => (ok ? validos.filter((_, i) => form[`g${i}`]?.checked) : null));
  if (!res || !res.length) return;
  const hoy = hoyISO();
  let n = 0;
  for (const r of res) {
    if (validarGuia(JSON.stringify(r.guia)).errores) continue;
    await importarGuia(r.guia);
    const s = datos.semanas.find((x) => x.id === r.guia.semana.slice(0, 10));
    if (s && s.fin < hoy) await guardar('semanas', { ...s, resumenVisto: true }); // sin resumen para semanas antiguas
    n++;
  }
  await actualizarRecuperacion({ completo: true });
  toast(`${n} guía(s) importada(s). Ahora marca lo que ya tienes.`);
}
