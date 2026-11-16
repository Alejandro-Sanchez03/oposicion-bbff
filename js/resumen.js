// =====================================================================
// resumen.js — Resumen de la semana que acaba de terminar
// y opción de pasar lo pendiente a la semana nueva.
// =====================================================================
import { datos, guardar } from './db.js';
import { hoyISO, rangoFechas, diferenciaDias } from './fechas.js';
import { estadoDia, minutosDelDia } from './racha.js';
import { repartirSemana, semanaDe } from './guia.js';

/** La última semana ya terminada (hace 7 días como mucho) cuyo resumen no has cerrado. */
export function semanaParaResumen() {
  const hoy = hoyISO();
  return [...datos.semanas]
    .filter((s) => s.fin < hoy && !s.resumenVisto && diferenciaDias(s.fin, hoy) <= 7)
    .sort((a, b) => b.fin.localeCompare(a.fin))[0] || null;
}

/** Números de la semana: tareas, minutos, días cumplidos, tests. */
export function resumenDe(semana) {
  const tareas = datos.tareas.filter((t) => t.semanaId === semana.id && t.tipo !== 'clase');
  const hechas = tareas.filter((t) => t.estado === 'hecha');
  const pendientes = tareas.filter((t) => t.estado !== 'hecha');
  const dias = rangoFechas(semana.inicio, semana.fin);
  const minutos = dias.reduce((s, f) => s + minutosDelDia(f), 0);
  const cumplidos = dias.filter((f) => estadoDia(f) === 'cumplido').length;
  const contables = dias.filter((f) => estadoDia(f) !== 'pausa' && estadoDia(f) !== 'antes').length;
  const tests = datos.tests.filter((t) => t.fecha >= semana.inicio && t.fecha <= semana.fin);
  const media = tests.length ? tests.reduce((s, t) => s + t.nota, 0) / tests.length : null;
  return {
    total: tareas.length, hechas: hechas.length, pendientes,
    obligatoriasPendientes: pendientes.filter((t) => t.obligatoria),
    minutos, cumplidos, contables, tests: tests.length, media,
  };
}

/**
 * Copia las tareas pendientes de una semana a la semana actual (como opcionales:
 * la guía nueva manda) y vuelve a repartir. Devuelve cuántas se han pasado.
 */
export async function pasarPendientes(semanaVieja) {
  const nueva = semanaDe(hoyISO());
  if (!nueva) return 0;
  const pendientes = resumenDe(semanaVieja).pendientes;
  const maxOrden = Math.max(0, ...datos.tareas.filter((t) => t.semanaId === nueva.id).map((t) => t.orden));
  const copias = pendientes.map((t, i) => ({
    ...t,
    uid: `${nueva.id}_atrasada_${t.uid}`,
    semanaId: nueva.id,
    id: `atrasada_${t.id}`,
    titulo: `${t.titulo} (de la semana pasada)`,
    obligatoria: false,
    minimo: false,
    dia_sugerido: null,
    dia_asignado: null,
    fijada: false,
    recolocadaDesde: null,
    orden: maxOrden + 1 + i,
  }));
  await guardar('tareas', copias);
  await guardar('semanas', { ...semanaVieja, resumenVisto: true });
  await repartirSemana(nueva.id);
  return copias.length;
}

export async function cerrarResumen(semana) {
  await guardar('semanas', { ...semana, resumenVisto: true });
}
