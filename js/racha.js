// =====================================================================
// racha.js — Mínimo diario, racha y comodines.
//
// Un día "cuenta" si llegas al mínimo: X minutos estudiados O Y tareas hechas.
// La racha son los días seguidos que cuentan. Cada semana (de viernes a
// jueves, como la guía) tienes 1 comodín para salvar un día fallado.
// Nada de esto se guarda: se calcula siempre a partir de las sesiones y tareas.
// =====================================================================
import { datos, guardar, nuevoId } from './db.js';
import { ajustes } from './ajustes.js';
import { hoyISO, sumarDias, inicioSemanaAcademia, diferenciaDias } from './fechas.js';

/** Minutos estudiados un día (suma de sesiones). */
export function minutosDelDia(iso) {
  return datos.sesiones.filter((s) => s.fecha === iso).reduce((t, s) => t + s.minutos, 0);
}

/** Tareas terminadas un día. */
export function tareasHechasDelDia(iso) {
  return datos.tareas.filter((t) => t.estado === 'hecha' && t.hechaEn === iso && t.tipo !== 'clase').length;
}

/** ¿Se cumplió el mínimo ese día? */
export function cumplido(iso) {
  const a = ajustes();
  return minutosDelDia(iso) >= a.minimoMinutos || tareasHechasDelDia(iso) >= a.minimoTareas;
}

export function usoComodin(iso) {
  return datos.comodines.some((c) => c.fecha === iso);
}

/** ¿Queda comodín en la semana de esa fecha? */
export function comodinDisponible(iso) {
  const semana = inicioSemanaAcademia(iso);
  return !datos.comodines.some((c) => c.semana === semana);
}

/**
 * Estado de un día para el calendario de racha:
 * 'cumplido' | 'comodin' | 'fallado' | 'hoy' (aún en juego) | 'futuro' | 'antes' (antes de empezar)
 */
export function estadoDia(iso) {
  const hoy = hoyISO();
  const inicio = ajustes().fechaInicio || hoy;
  if (iso > hoy) return 'futuro';
  if (iso < inicio) return 'antes';
  if (cumplido(iso)) return 'cumplido';
  if (usoComodin(iso)) return 'comodin';
  return iso === hoy ? 'hoy' : 'fallado';
}

/** Días seguidos cumplidos (los comodines no suman pero no rompen). Hoy solo suma si ya está cumplido. */
export function rachaActual() {
  let racha = 0;
  for (let f = hoyISO(); ; f = sumarDias(f, -1)) {
    const e = estadoDia(f);
    if (e === 'cumplido') racha++;
    else if (e === 'comodin' || e === 'hoy') continue;
    else break; // 'fallado' o 'antes'
  }
  return racha;
}

/** Mejor racha histórica. */
export function mejorRacha() {
  const inicio = ajustes().fechaInicio || hoyISO();
  let mejor = 0, actual = 0;
  for (let f = inicio; f <= hoyISO(); f = sumarDias(f, 1)) {
    const e = estadoDia(f);
    if (e === 'cumplido') { actual++; mejor = Math.max(mejor, actual); }
    else if (e === 'fallado') actual = 0;
  }
  return mejor;
}

/**
 * Si hay un día fallado reciente (de los últimos 7) que rompe la racha y
 * su semana aún tiene comodín, devuelve esa fecha para ofrecer usarlo.
 */
export function diaParaComodin() {
  for (let f = sumarDias(hoyISO(), -1); diferenciaDias(f, hoyISO()) <= 7; f = sumarDias(f, -1)) {
    const e = estadoDia(f);
    if (e === 'cumplido' || e === 'comodin') continue;
    if (e === 'fallado' && comodinDisponible(f)) return f;
    return null;
  }
  return null;
}

export async function usarComodin(iso) {
  await guardar('comodines', { fecha: iso, semana: inicioSemanaAcademia(iso) });
}

/** Registra tiempo de estudio. */
export async function registrarSesion({ minutos, tareaUid = null, fecha = hoyISO() }) {
  if (minutos <= 0) return;
  await guardar('sesiones', { id: nuevoId(), fecha, tareaUid, minutos, hora: new Date().toISOString() });
  if (tareaUid) {
    const t = datos.tareas.find((x) => x.uid === tareaUid);
    if (t) await guardar('tareas', { ...t, minutosDedicados: (t.minutosDedicados || 0) + minutos });
  }
}
