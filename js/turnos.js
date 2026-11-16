// =====================================================================
// turnos.js — Saber si un día es de TURNO o LIBRE.
//
// 1) Si has corregido ese día a mano (almacén `dias`), manda eso.
// 2) Si no, se calcula con el patrón: una secuencia que se repite, p. ej.
//    "TTTTLLL" = 4 días de turno y 3 libres, empezando en la fecha de inicio.
// 3) Si no hay patrón ni corrección, el día queda "sin definir".
// =====================================================================
import { datos, guardar, borrar } from './db.js';
import { ajustes } from './ajustes.js';
import { diferenciaDias } from './fechas.js';

/** Tipo según el patrón (sin tener en cuenta correcciones). */
export function tipoSegunPatron(iso) {
  const p = ajustes().patron;
  if (!p || !p.inicio || !p.secuencia) return null;
  const n = p.secuencia.length;
  const pos = ((diferenciaDias(p.inicio, iso) % n) + n) % n; // módulo positivo
  return p.secuencia[pos] === 'T' ? 'turno' : 'libre';
}

/** 'turno', 'libre' o null (sin definir). */
export function tipoDia(iso) {
  const manual = datos.dias.find((d) => d.fecha === iso);
  return manual ? manual.tipo : tipoSegunPatron(iso);
}

/** ¿Este día está corregido a mano? */
export function esManual(iso) {
  return datos.dias.some((d) => d.fecha === iso);
}

/** Minutos de tareas que caben ese día. Un día sin definir cuenta como turno (prudente). */
export function capacidadDia(iso) {
  const a = ajustes();
  return tipoDia(iso) === 'libre' ? a.minutosLibre : a.minutosTurno;
}

/** Cambia un día de turno a libre o al revés. Si coincide con el patrón, se quita la corrección. */
export async function alternarDia(iso) {
  const nuevo = tipoDia(iso) === 'turno' ? 'libre' : 'turno';
  if (nuevo === tipoSegunPatron(iso)) await borrar('dias', iso);
  else await guardar('dias', { fecha: iso, tipo: nuevo });
}

/** Construye la secuencia a partir de "X días de turno, Y libres". */
export function secuenciaDesde(diasTurno, diasLibre) {
  return 'T'.repeat(diasTurno) + 'L'.repeat(diasLibre);
}
