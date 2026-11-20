// =====================================================================
// temario.js — El listado de todo el temario y su relación con
// las guías (tareas) y las notas de los tests.
//
// - Los temas de cada guía que cargas se añaden solos al temario.
// - Al hacer las tareas de un tema, su estado sube solo:
//   pendiente → estudiado (todas sus tareas de estudio hechas) → repasado (un repaso hecho).
//   Nunca baja solo: si lo cambias tú, se respeta.
// - Cada tema muestra sus notas de tests y si flojea.
// =====================================================================
import { datos, guardar, nuevoId } from './db.js';

/** Normaliza un nombre para comparar: minúsculas, sin tildes ni signos. */
export const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9/]+/g, ' ').trim();

/** Grupo en el que encaja un tema por su nombre (para ordenar el listado). */
export function grupoPara(nombre) {
  const n = normalizar(nombre);
  if (/^peif\b/.test(n)) return 'PEIF';
  if (/^ptecv\b/.test(n)) return 'PTECV';
  if (/^(ft|ficha|fichas)\b/.test(n)) return 'Fichas técnicas';
  if (/^(ley|decreto|real decreto|orden|dl|rd|reglamento)\b/.test(n)) return 'Legislación';
  if (/psicot|aptitud|sinonim|antonim|razonamiento/.test(n)) return 'Psicotécnico';
  return 'Otros';
}

const ORDEN_ESTADO = { pendiente: 0, estudiado: 1, repasado: 2 };

/** Tema del temario que corresponde a un nombre (o undefined). */
export function temaPorNombre(nombre) {
  const n = normalizar(nombre);
  return datos.temas.find((t) => normalizar(t.nombre) === n);
}

/** Añade al temario los temas de las guías que aún no estén. Devuelve cuántos ha añadido. */
export async function temasDesdeGuias() {
  const grupos = new Set(datos.temas.map((t) => normalizar(t.grupo)));
  const nuevos = [];
  let orden = Math.max(0, ...datos.temas.map((t) => t.orden || 0)) + 1;
  const nombres = [...new Set(datos.tareas.filter((t) => t.tipo !== 'clase' && t.tema && t.tema !== 'Academia').map((t) => t.tema))];
  for (const nombre of nombres) {
    if (temaPorNombre(nombre) || nuevos.some((x) => normalizar(x.nombre) === normalizar(nombre))) continue;
    if (grupos.has(normalizar(nombre))) continue; // "PEIF" ya es un grupo con sus apartados
    nuevos.push({ id: nuevoId() + nuevos.length, nombre, grupo: grupoPara(nombre), estado: 'pendiente', orden: orden++, origen: 'guia' });
  }
  if (nuevos.length) await guardar('temas', nuevos);
  return nuevos.length;
}

/** Sube el estado de un tema según sus tareas hechas (nunca lo baja). */
export async function actualizarEstadoTema(nombreTema) {
  const tema = temaPorNombre(nombreTema);
  if (!tema) return;
  const tareas = datos.tareas.filter((t) => normalizar(t.tema) === normalizar(nombreTema) && t.tipo !== 'clase');
  const estudios = tareas.filter((t) => t.tipo === 'estudio');
  let sugerido = 'pendiente';
  if (estudios.length && estudios.every((t) => t.estado === 'hecha')) sugerido = 'estudiado';
  if (sugerido === 'estudiado' && tareas.some((t) => t.tipo === 'repaso' && t.estado === 'hecha')) sugerido = 'repasado';
  if (ORDEN_ESTADO[sugerido] > ORDEN_ESTADO[tema.estado || 'pendiente']) {
    await guardar('temas', { ...tema, estado: sugerido });
  }
}

/** Notas de un tema, de la más antigua a la más reciente. */
export function notasDe(nombreTema) {
  const n = normalizar(nombreTema);
  return datos.tests.filter((t) => normalizar(t.tema) === n).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.creado || '').localeCompare(b.creado || ''));
}

/** Resumen de notas: { ultima, media, n, tendencia: 'sube'|'baja'|null }. */
export function resumenNotas(nombreTema) {
  const notas = notasDe(nombreTema);
  if (!notas.length) return null;
  const media = notas.reduce((s, t) => s + t.nota, 0) / notas.length;
  const ultima = notas[notas.length - 1].nota;
  let tendencia = null;
  if (notas.length >= 2) {
    const dif = ultima - notas[notas.length - 2].nota;
    if (dif >= 0.5) tendencia = 'sube'; else if (dif <= -0.5) tendencia = 'baja';
  }
  return { ultima, media, n: notas.length, tendencia };
}

/** Temas que flojean: última nota < 5 o media < 6. Los peores primero. */
export function temasFlojos() {
  const nombres = [...new Set(datos.tests.map((t) => t.tema))];
  return nombres
    .map((nombre) => ({ nombre, ...resumenNotas(nombre) }))
    .filter((r) => r.ultima < 5 || r.media < 6)
    .sort((a, b) => a.ultima - b.ultima);
}
