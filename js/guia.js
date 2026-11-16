// =====================================================================
// guia.js — Importar la guía semanal (JSON) y aplicar el reparto.
// =====================================================================
import { datos, guardar, borrar } from './db.js';
import { ajustes } from './ajustes.js';
import { tipoDia, capacidadDia } from './turnos.js';
import { esFechaValida, hoyISO, inicioSemanaAcademia, rangoFechas, sumarDias, textoCorto } from './fechas.js';
import { repartir } from './reparto.js';

export const TIPOS = ['estudio', 'test', 'autoevaluacion', 'repaso', 'psicotecnico', 'clase'];
export const NOMBRE_TIPO = {
  estudio: 'Estudio', test: 'Test', autoevaluacion: 'Autoevaluación',
  repaso: 'Repaso', psicotecnico: 'Psicotécnico', clase: 'Clase',
};

/** Convierte la posición de un error de JSON en "línea X, columna Y". */
function lineaDeError(texto, mensaje) {
  const m = /position (\d+)/.exec(mensaje);
  if (!m) return '';
  const antes = texto.slice(0, Number(m[1]));
  const linea = antes.split('\n').length;
  const columna = antes.length - antes.lastIndexOf('\n');
  return ` (línea ${linea}, columna ${columna})`;
}

/**
 * Lee y comprueba el JSON de la guía.
 * Devuelve { guia } si es correcto o { errores: [...] } con explicaciones claras.
 */
export function validarGuia(texto) {
  let g;
  try {
    g = JSON.parse(texto);
  } catch (e) {
    let pista = '';
    if (/[“”]/.test(texto)) pista = ' Hay comillas “tipográficas”: usa comillas rectas ".';
    else if (/,\s*[}\]]/.test(texto)) pista = ' Puede que sobre una coma antes de } o ].';
    return { errores: [`El texto no es un JSON válido${lineaDeError(texto, e.message)}.${pista}`] };
  }
  const errores = [];
  if (!g || typeof g !== 'object' || Array.isArray(g)) return { errores: ['El JSON debe ser un objeto { ... }.'] };

  const sem = /^(\d{4}-\d{2}-\d{2}) a (\d{4}-\d{2}-\d{2})$/.exec(g.semana || '');
  if (!sem || !esFechaValida(sem[1]) || !esFechaValida(sem[2])) {
    errores.push('"semana" debe tener el formato "2026-11-13 a 2026-11-19".');
  }
  if (typeof g.fecha_limite !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(g.fecha_limite) ||
      !esFechaValida(g.fecha_limite.slice(0, 10))) {
    errores.push('"fecha_limite" debe tener el formato "2026-11-19T17:00".');
  }
  if (g.prioridad !== undefined && (!Array.isArray(g.prioridad) || g.prioridad.some((p) => typeof p !== 'string'))) {
    errores.push('"prioridad" debe ser una lista de textos, p. ej. ["PEIF", "Psicotécnico"].');
  }
  if (g.plan_minimo !== undefined && g.plan_minimo !== null && typeof g.plan_minimo !== 'string') {
    errores.push('"plan_minimo" debe ser un texto.');
  }
  if (!Array.isArray(g.tareas) || !g.tareas.length) {
    errores.push('"tareas" debe ser una lista con al menos una tarea.');
    return { errores };
  }
  const ids = new Set();
  g.tareas.forEach((t, i) => {
    const nombre = `Tarea ${i + 1}${t && t.id ? ` (${t.id})` : ''}`;
    if (!t || typeof t !== 'object') { errores.push(`${nombre}: no es un objeto { ... }.`); return; }
    if (typeof t.id !== 'string' || !t.id) errores.push(`${nombre}: falta "id".`);
    else if (ids.has(t.id)) errores.push(`${nombre}: el id "${t.id}" está repetido.`);
    ids.add(t.id);
    if (typeof t.titulo !== 'string' || !t.titulo.trim()) errores.push(`${nombre}: falta "titulo".`);
    if (typeof t.tema !== 'string' || !t.tema.trim()) errores.push(`${nombre}: falta "tema".`);
    if (!TIPOS.includes(t.tipo)) errores.push(`${nombre}: "tipo" debe ser uno de: ${TIPOS.join(', ')} (pone "${t.tipo}").`);
    if (typeof t.obligatoria !== 'boolean') errores.push(`${nombre}: "obligatoria" debe ser true o false (sin comillas).`);
    if (t.minimo !== undefined && typeof t.minimo !== 'boolean') errores.push(`${nombre}: "minimo" debe ser true o false (sin comillas).`);
    if (t.tipo !== 'clase' && (typeof t.minutos !== 'number' || t.minutos <= 0)) {
      errores.push(`${nombre}: "minutos" debe ser un número mayor que 0 (sin comillas).`);
    }
    if (t.dia_sugerido != null && !esFechaValida(t.dia_sugerido)) {
      errores.push(`${nombre}: "dia_sugerido" debe ser una fecha como "2026-11-13".`);
    } else if (sem && t.dia_sugerido && (t.dia_sugerido < sem[1] || t.dia_sugerido > sem[2])) {
      errores.push(`${nombre}: "dia_sugerido" (${t.dia_sugerido}) está fuera de la semana.`);
    }
  });
  return errores.length ? { errores } : { guia: g };
}

/**
 * Convierte la guía en registros de la app. Las tareas de estudio más largas
 * que un día libre se parten en bloques "(1/2)", "(2/2)".
 */
function construirTareas(guia, semanaId, fin) {
  const maxLibre = ajustes().minutosLibre;
  const tareas = [];
  let orden = 0;
  for (const t of guia.tareas) {
    const base = {
      semanaId, id: t.id, titulo: t.titulo.trim(), tema: t.tema.trim(), tipo: t.tipo,
      obligatoria: t.obligatoria, minimo: !!t.minimo, minutos: t.tipo === 'clase' ? 0 : Math.round(t.minutos),
      dia_sugerido: t.dia_sugerido || null, dia_asignado: null, fijada: false,
      estado: 'pendiente', hechaEn: null, minutosDedicados: 0, recolocadaDesde: null,
    };
    if (t.tipo === 'clase') {
      tareas.push({ ...base, uid: `${semanaId}_${t.id}`, orden: orden++, dia_asignado: fin, fijada: true });
    } else if (base.minutos > maxLibre) {
      const partes = Math.ceil(base.minutos / maxLibre);
      for (let p = 1; p <= partes; p++) {
        tareas.push({
          ...base, uid: `${semanaId}_${t.id}_p${p}`, orden: orden++,
          titulo: `${base.titulo} (${p}/${partes})`, minutos: Math.ceil(base.minutos / partes),
        });
      }
    } else {
      tareas.push({ ...base, uid: `${semanaId}_${t.id}`, orden: orden++ });
    }
  }
  return tareas;
}

/** Guarda la guía. Si ya existía esa semana, conserva lo que ya hubieras hecho. */
export async function importarGuia(guia) {
  const [inicio] = guia.semana.split(' a ');
  const fin = guia.fecha_limite.slice(0, 10);
  const semanaId = inicio;
  const anteriores = datos.tareas.filter((t) => t.semanaId === semanaId);
  const nuevas = construirTareas(guia, semanaId, fin);
  for (const t of nuevas) {
    const vieja = anteriores.find((a) => a.uid === t.uid);
    if (vieja) Object.assign(t, {
      estado: vieja.estado, hechaEn: vieja.hechaEn, minutosDedicados: vieja.minutosDedicados,
      fijada: vieja.fijada || t.fijada, dia_asignado: vieja.fijada ? vieja.dia_asignado : t.dia_asignado,
    });
  }
  await borrar('tareas', anteriores.map((t) => t.uid));
  await guardar('semanas', {
    id: semanaId, texto: guia.semana, inicio, fin, fecha_limite: guia.fecha_limite,
    prioridad: guia.prioridad || [], plan_minimo: guia.plan_minimo || '',
    modoMinimos: false, avisos: [], importada: new Date().toISOString(),
  });
  await guardar('tareas', nuevas);
  return repartirSemana(semanaId);
}

/** Días disponibles de una semana: desde hoy (o su inicio) hasta la fecha límite. */
export function diasDisponibles(semana) {
  const desde = semana.inicio > hoyISO() ? semana.inicio : hoyISO();
  if (desde > semana.fin) return [];
  return rangoFechas(desde, semana.fin).map((fecha) => ({
    fecha, tipo: tipoDia(fecha) || 'turno', capacidad: capacidadDia(fecha),
  }));
}

/**
 * Vuelve a repartir una semana.
 * @param {string[]} [soloEstas] uids que se deben mover (el resto se queda quieto).
 */
export async function repartirSemana(semanaId, soloEstas = null) {
  const semana = datos.semanas.find((s) => s.id === semanaId);
  const tareas = datos.tareas.filter((t) => t.semanaId === semanaId);
  const resultado = repartir({
    tareas, dias: diasDisponibles(semana), prioridad: semana.prioridad,
    modoMinimos: semana.modoMinimos, soloEstas,
  });
  const cambiadas = [];
  for (const t of tareas) {
    const nuevo = resultado.asignacion[t.uid];
    if (nuevo !== undefined && nuevo !== t.dia_asignado) {
      cambiadas.push({ ...t, dia_asignado: nuevo });
    }
  }
  await guardar('tareas', cambiadas);
  await guardar('semanas', { ...semana, avisos: resultado.avisos });
  return resultado;
}

/**
 * Se ejecuta al abrir la app cada día: las tareas pendientes de días pasados
 * se recolocan en los días que quedan de su semana.
 * Devuelve una lista de mensajes para mostrar en la pantalla HOY.
 */
export async function recolocarAtrasadas() {
  const hoy = hoyISO();
  const mensajes = [];
  for (const semana of datos.semanas.filter((s) => s.fin >= hoy)) {
    const atrasadas = datos.tareas.filter((t) => t.semanaId === semana.id && t.estado !== 'hecha' &&
      t.tipo !== 'clase' && t.dia_asignado && t.dia_asignado < hoy);
    if (!atrasadas.length) continue;
    // Se marcan como "no fijadas" para que el reparto pueda moverlas y se recuerda de dónde venían.
    await guardar('tareas', atrasadas.map((t) => ({ ...t, fijada: false, recolocadaDesde: t.dia_asignado })));
    const uids = atrasadas.map((t) => t.uid);
    let r = await repartirSemana(semana.id, uids);
    // Si alguna no cabe moviendo solo las atrasadas, se reparte la semana entera.
    if (uids.some((u) => r.asignacion[u] == null)) r = await repartirSemana(semana.id);
    for (const t of atrasadas) {
      const dia = r.asignacion[t.uid];
      mensajes.push(dia
        ? `«${t.titulo}» se quedó sin hacer el ${textoCorto(t.dia_asignado)} → la he pasado al ${textoCorto(dia)}.`
        : `«${t.titulo}» se quedó sin hacer y ya no cabe esta semana.`);
    }
  }
  return mensajes;
}

/** Mueve una tarea a mano a otro día (queda "fijada": el reparto ya no la mueve). */
export async function moverTarea(uid, nuevoDia) {
  const t = datos.tareas.find((x) => x.uid === uid);
  await guardar('tareas', { ...t, dia_asignado: nuevoDia, fijada: true });
}

/** Tareas de un día concreto (de todas las semanas). */
export function tareasDelDia(iso) {
  return datos.tareas.filter((t) => t.dia_asignado === iso);
}

/** Minutos ocupados un día (sin contar clases). */
export function minutosOcupados(iso) {
  return tareasDelDia(iso).filter((t) => t.tipo !== 'clase').reduce((s, t) => s + t.minutos, 0);
}

/** Semana que contiene una fecha (o la más próxima a futuro). */
export function semanaDe(iso) {
  return datos.semanas.find((s) => s.inicio <= iso && iso <= s.fin) || null;
}

/** Guía de ejemplo (para el botón "Ver ejemplo"). */
export function ejemploGuia() {
  const inicio = inicioSemanaAcademia(hoyISO()); // viernes de esta semana
  const d = (n) => sumarDias(inicio, n);
  return JSON.stringify({
    semana: `${d(0)} a ${d(6)}`,
    fecha_limite: `${d(6)}T17:00`,
    prioridad: ['PEIF', 'Psicotécnico'],
    plan_minimo: 'Si vas agobiado, céntrate solo en el Documento IV y el Anexo 2',
    tareas: [
      { id: 't1', titulo: 'Estudiar apartado 4 PEIF', tema: 'PEIF', tipo: 'estudio', obligatoria: true, dia_sugerido: d(0), minutos: 120, minimo: false },
      { id: 't2', titulo: 'Test apartado 4', tema: 'PEIF', tipo: 'test', obligatoria: true, dia_sugerido: d(1), minutos: 30, minimo: true },
      { id: 't3', titulo: 'Aptitud numérica 02', tema: 'Psicotécnico', tipo: 'psicotecnico', obligatoria: false, dia_sugerido: d(3), minutos: 45, minimo: false },
    ],
  }, null, 2);
}
