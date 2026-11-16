// =====================================================================
// ajustes.js — Ajustes de la app y valores por defecto.
// Si quieres cambiar un valor por defecto, hazlo aquí.
// =====================================================================
import { datos, guardar, nuevoId } from './db.js';
import { hoyISO } from './fechas.js';

export const AJUSTES_POR_DEFECTO = {
  id: 'principal',
  minutosTurno: 45,        // máximo de tareas en un día de TURNO
  minutosLibre: 210,       // máximo de tareas en un día LIBRE (3 h 30 min)
  pomodoroEstudio: 25,     // minutos de estudio por bloque
  pomodoroDescanso: 5,     // minutos de descanso
  minimoMinutos: 20,       // mínimo diario: minutos...
  minimoTareas: 1,         // ...o tareas terminadas (basta con cumplir una de las dos)
  penalizacion: 3,         // nota de tests: cada N fallos restan un acierto (0 = sin penalización)
  tema: 'auto',            // 'auto', 'claro' u 'oscuro'
  patron: null,            // { inicio: 'AAAA-MM-DD', secuencia: 'TTTTLLL' }
  proximo: '',             // "LO PRÓXIMO": lo que escribiste al acabar la última sesión
  proximoFecha: null,
  frasesUsadas: [],        // índices de frases ya mostradas (para no repetir)
  fraseHoy: null,          // { fecha, indice }
  fechaInicio: null,       // primer día que usaste la app (la racha empieza aquí)
  ultimaRevision: null,    // último día en que se recolocaron tareas atrasadas
  fechaExamen: null,       // para la cuenta atrás ("Faltan X días")
  ultimaCopia: null,       // última copia de seguridad exportada (para recordártelo)
  bienvenidaHecha: false,  // ¿ya se mostró el asistente de la primera vez?
  notificaciones: { activas: false, hora: '07:30', dias: 'todos' }, // fase 4
};

/** Temario inicial (se crea la primera vez que abres la app). */
const TEMARIO_INICIAL = [
  ['PEIF', 'PEIF · Apartado 1'],
  ['PEIF', 'PEIF · Apartado 2'],
  ['PEIF', 'PEIF · Apartado 3'],
  ['PEIF', 'PEIF · Apartado 4'],
  ['PEIF', 'PEIF · Apartado 5'],
  ['PEIF', 'PEIF · Anexos'],
  ['Legislación', 'Decreto Ley 4/2018 (SGISE)'],
  ['Legislación', 'Decreto 129/2018 (Reglamento SBF)'],
  ['Fichas técnicas PE', 'PE · Espumógenos'],
  ['Fichas técnicas PE', 'PE · Extintores'],
  ['Fichas PH', 'PH · Herramientas'],
  ['Fichas PH', 'PH · Técnicas'],
  ['Psicotécnico', 'Psicotécnico'],
];

/** Devuelve los ajustes (siempre completos, aunque falte algún campo nuevo). */
export function ajustes() {
  const guardados = datos.ajustes.find((a) => a.id === 'principal') || {};
  return {
    ...AJUSTES_POR_DEFECTO,
    ...guardados,
    notificaciones: { ...AJUSTES_POR_DEFECTO.notificaciones, ...(guardados.notificaciones || {}) },
  };
}

/** Cambia uno o varios ajustes. Ej: cambiarAjustes({ minutosTurno: 60 }) */
export async function cambiarAjustes(cambios) {
  await guardar('ajustes', { ...ajustes(), ...cambios });
}

/** Prepara la app la primera vez que se abre. */
export async function inicializarSiHaceFalta() {
  if (!datos.ajustes.length) {
    await guardar('ajustes', { ...AJUSTES_POR_DEFECTO, fechaInicio: hoyISO() });
  }
  if (!datos.temas.length) {
    await guardar('temas', TEMARIO_INICIAL.map(([grupo, nombre], i) => ({
      id: nuevoId() + i, grupo, nombre, estado: 'pendiente', orden: i,
    })));
  }
}

/** Aplica el modo claro/oscuro. */
export function aplicarTema() {
  const t = ajustes().tema;
  const html = document.documentElement;
  if (t === 'auto') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light');
}
