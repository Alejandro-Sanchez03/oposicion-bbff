// =====================================================================
// atrasado.js — Lo que se quedó sin hacer de semanas anteriores y
// cómo recuperarlo sin abandonar la planificación de la academia.
//
// CRITERIO (lo que aconseja la app):
//  1. Lo obligatorio de la semana actual va primero: marca el ritmo de
//     las clases y del test del jueves.
//  2. Después, lo OBLIGATORIO atrasado, de lo más antiguo a lo más nuevo,
//     en los huecos libres (va antes que lo opcional de la semana).
//  3. Lo opcional atrasado, solo si vas sobrado (se añade a mano).
//
// Recuperar = crear en la semana actual una COPIA de la tarea antigua
// (`rescate: true`, `origenUid`). Al hacer la copia, la original queda hecha.
// =====================================================================
import { datos, guardar, borrar } from './db.js';
import { ajustes } from './ajustes.js';
import { hoyISO, rangoFechas } from './fechas.js';
import { capacidadDia } from './turnos.js';
import { minutosOcupados } from './guia.js';
import { semanaDe, repartirSemana, marcarTareaHecha } from './guia.js';

const esCopia = (t) => t.rescate || String(t.uid).includes('_atrasada_');

/** Copias (pendientes o hechas) que hay de cada tarea original: Map origenUid → copia. */
function copiasPorOrigen() {
  const m = new Map();
  for (const t of datos.tareas) if (t.origenUid) m.set(t.origenUid, t);
  return m;
}

/**
 * Tareas atrasadas: de semanas ya terminadas, sin hacer y sin descartar.
 * Ordenadas como se recomienda recuperarlas: obligatorias primero, lo más antiguo primero.
 */
export function atrasadas({ incluirDescartadas = false } = {}) {
  const hoy = hoyISO();
  const pasadas = new Map(datos.semanas.filter((s) => s.fin < hoy).map((s) => [s.id, s]));
  return datos.tareas
    .filter((t) => pasadas.has(t.semanaId) && t.tipo !== 'clase' && !esCopia(t) && t.estado !== 'hecha' &&
      (incluirDescartadas || t.estado !== 'descartada'))
    .sort((a, b) => (b.obligatoria - a.obligatoria) || a.semanaId.localeCompare(b.semanaId) ||
      (a.dia_sugerido || '').localeCompare(b.dia_sugerido || '') || a.orden - b.orden);
}

/** Copia activa (en la semana actual) de una tarea atrasada, si la hay. */
export function copiaActiva(uidOriginal) {
  const actual = semanaDe(hoyISO());
  if (!actual) return null;
  return datos.tareas.find((t) => t.origenUid === uidOriginal && t.semanaId === actual.id) || null;
}

/** Crea (sin guardar) la copia de recuperación de una tarea en la semana dada. */
function crearCopia(orig, semana, auto, orden) {
  return {
    ...orig,
    uid: `${semana.id}_rescate_${orig.uid}`,
    semanaId: semana.id,
    id: `rescate_${orig.id}`,
    origenUid: orig.uid,
    origenSemana: orig.semanaId,
    rescate: true,
    auto,
    obligatoria: false, // la guía de esta semana manda
    minimo: false,
    estado: 'pendiente', hechaEn: null, minutosDedicados: 0,
    dia_sugerido: null, dia_asignado: null, fijada: false, recolocadaDesde: null,
    orden,
  };
}

function siguienteOrden(semana) {
  return Math.max(0, ...datos.tareas.filter((t) => t.semanaId === semana.id).map((t) => t.orden)) + 1;
}

/** Añade a mano tareas atrasadas a la semana actual. Devuelve cuántas se han colocado en algún día. */
export async function recuperarEstaSemana(uids) {
  const semana = semanaDe(hoyISO());
  if (!semana) return { ok: false, motivo: 'No hay guía cargada para esta semana.' };
  let orden = siguienteOrden(semana);
  const copias = uids.map((u) => datos.tareas.find((t) => t.uid === u)).filter(Boolean)
    .filter((o) => !copiaActiva(o.uid))
    .map((o) => crearCopia(o, semana, false, orden++));
  await guardar('tareas', copias);
  const r = await repartirSemana(semana.id, copias.map((c) => c.uid));
  return { ok: true, colocadas: copias.filter((c) => r.asignacion[c.uid]).length, total: copias.length };
}

/** "Ya lo estudié": marca la original como hecha (y quita copias pendientes). */
export async function yaLoTengo(uids) {
  for (const u of uids) {
    const t = datos.tareas.find((x) => x.uid === u);
    if (!t) continue;
    await marcarTareaHecha(t, true);
    const copias = datos.tareas.filter((c) => c.origenUid === u && c.estado !== 'hecha').map((c) => c.uid);
    if (copias.length) await borrar('tareas', copias);
  }
}

/** Descartar / volver a poner una tarea atrasada. */
export async function descartar(uid, si = true) {
  const t = datos.tareas.find((x) => x.uid === uid);
  if (!t) return;
  await guardar('tareas', { ...t, estado: si ? 'descartada' : 'pendiente' });
  if (si) {
    const copias = datos.tareas.filter((c) => c.origenUid === uid && c.estado !== 'hecha').map((c) => c.uid);
    if (copias.length) await borrar('tareas', copias);
  }
}

/** Minutos libres que deja la guía de esta semana (contando toda la semana, de viernes a jueves). */
export function huecoSemanal(semana = semanaDe(hoyISO())) {
  if (!semana) return null;
  const cap = rangoFechas(semana.inicio, semana.fin).reduce((s, f) => s + capacidadDia(f), 0);
  const academia = datos.tareas.filter((t) => t.semanaId === semana.id && !t.rescate && t.obligatoria && t.tipo !== 'clase')
    .reduce((s, t) => s + t.minutos, 0);
  return Math.max(0, cap - academia);
}

/** Minutos libres que quedan de verdad desde hoy hasta el jueves (con todo lo ya programado). */
export function huecoRestante(semana = semanaDe(hoyISO())) {
  if (!semana) return null;
  const hoy = hoyISO();
  return rangoFechas(hoy > semana.inicio ? hoy : semana.inicio, semana.fin)
    .reduce((s, f) => s + Math.max(0, capacidadDia(f) - minutosOcupados(f)), 0);
}

/** Consejo: qué hacer con lo atrasado, con números. */
export function consejo() {
  const lista = atrasadas();
  const obl = lista.filter((t) => t.obligatoria);
  const opc = lista.filter((t) => !t.obligatoria);
  const minObl = obl.reduce((s, t) => s + t.minutos, 0);
  const hueco = huecoSemanal();
  const semanasNecesarias = hueco ? Math.ceil(minObl / hueco) : null;
  return { total: lista.length, obl: obl.length, opc: opc.length, minObl, minOpc: opc.reduce((s, t) => s + t.minutos, 0), hueco, restante: huecoRestante(), semanasNecesarias };
}

/**
 * Recuperación automática: rellena los huecos de la semana actual con lo obligatorio atrasado.
 * @param {boolean} completo  true = reparto completo de la semana (lo atrasado va antes que las opcionales);
 *                            false = solo usa el hueco que quede (no mueve tus otras tareas).
 */
export async function actualizarRecuperacion({ completo = false } = {}) {
  const semana = semanaDe(hoyISO());
  if (!semana) return;
  const autoPrevias = datos.tareas.filter((t) => t.semanaId === semana.id && t.rescate && t.auto && t.estado !== 'hecha' && !t.fijada);
  if (!ajustes().recuperarAuto) {
    if (autoPrevias.length) {
      await borrar('tareas', autoPrevias.map((t) => t.uid));
      await repartirSemana(semana.id, []);
    }
    return;
  }
  // Candidatas: obligatorias atrasadas sin copia ya hecha a mano, hasta llenar la capacidad que queda.
  const dias = rangoFechas(hoyISO() > semana.inicio ? hoyISO() : semana.inicio, semana.fin);
  const capacidad = dias.reduce((s, f) => s + capacidadDia(f), 0);
  const deseadas = [];
  let suma = 0;
  for (const o of atrasadas().filter((t) => t.obligatoria)) {
    const c = copiaActiva(o.uid);
    if (c && !c.auto) continue;          // ya la añadiste tú
    if (suma + o.minutos > capacidad) break;
    suma += o.minutos;
    deseadas.push(o);
  }
  let orden = siguienteOrden(semana);
  const copias = deseadas.map((o) => {
    const prev = autoPrevias.find((p) => p.origenUid === o.uid);
    return prev || crearCopia(o, semana, true, orden++);
  });
  const sobran = autoPrevias.filter((p) => !copias.includes(p)).map((p) => p.uid);
  if (sobran.length) await borrar('tareas', sobran);
  await guardar('tareas', copias.filter((c) => !autoPrevias.includes(c)));
  const r = await repartirSemana(semana.id, completo ? null : copias.map((c) => c.uid));
  // Las que no caben, fuera (se volverán a intentar otro día).
  const sinHueco = copias.filter((c) => r.asignacion[c.uid] == null).map((c) => c.uid);
  if (sinHueco.length) await borrar('tareas', sinHueco);
}

