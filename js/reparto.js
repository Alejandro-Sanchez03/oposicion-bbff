// =====================================================================
// reparto.js — EL CEREBRO: reparte las tareas de una semana entre los días.
//
// Este archivo NO toca la base de datos ni la pantalla: recibe datos y
// devuelve un resultado. Así se puede probar por separado
// (ver tests/probar-reparto.mjs).
//
// REGLAS
//  1. Tareas PESADAS (tipo "estudio") → preferentemente días LIBRES.
//     Si no queda ningún libre con hueco, van a un día de turno (con aviso).
//  2. Tareas LIGERAS (test, autoevaluación, repaso, psicotécnico) → cualquier día.
//  3. Cada día tiene una capacidad en minutos (turno ≈ 45, libre ≈ 210).
//  4. Orden lógico: dentro de un mismo tema, un estudio, test o autoevaluación
//     nunca va antes que los "estudio" de ese tema que aparecen antes en la
//     guía. (Los repasos y psicotécnicos no dependen de nada.)
//  5. Primero las obligatorias (por orden de prioridad), luego las opcionales
//     si queda hueco.
//  6. Cada tarea va a su día sugerido si se puede; si no, al más cercano.
//  7. Modo "plan de mínimos": las tareas marcadas `minimo` pasan a ser las
//     importantes y el resto de obligatorias solo entran si sobra hueco.
// =====================================================================

/** Rango de cada tipo de tarea (para ordenar las tareas de un mismo día). */
export const RANGO_TIPO = { clase: 9, estudio: 0, repaso: 1, psicotecnico: 1, autoevaluacion: 2, test: 2 };

export const esPesada = (t) => t.tipo === 'estudio';

/**
 * Calcula las dependencias de cada tarea (qué tareas tienen que ir antes).
 * Devuelve un Map uid → [uids de las que depende].
 */
export function calcularDependencias(tareas) {
  const deps = new Map();
  for (const t of tareas) {
    // Repasar es volver sobre algo ya estudiado: no espera a estudios nuevos.
    // Los psicotécnicos tampoco dependen de nada.
    if (t.tipo === 'repaso' || t.tipo === 'psicotecnico' || t.tipo === 'clase') { deps.set(t.uid, []); continue; }
    deps.set(t.uid, tareas
      .filter((o) => o.tema === t.tema && o.tipo === 'estudio' && o.orden < t.orden)
      .map((o) => o.uid));
  }
  return deps;
}

/**
 * Reparte las tareas.
 * @param {object} p
 * @param {Array}  p.tareas     Todas las tareas de la semana.
 * @param {Array}  p.dias       Días disponibles en orden: [{ fecha, tipo, capacidad }].
 * @param {Array}  p.prioridad  Temas en orden de prioridad.
 * @param {boolean} p.modoMinimos  ¿Aplicar plan de mínimos?
 * @param {Array}  [p.soloEstas] Si se indica, solo se mueven estas tareas (uids);
 *                               las demás se quedan donde están.
 * @returns {{ asignacion: Object<string,string|null>, avisos: string[], noCabenObligatorias: string[] }}
 */
export function repartir({ tareas, dias, prioridad = [], modoMinimos = false, soloEstas = null }) {
  const primerDia = dias.length ? dias[0].fecha : null;
  const fechasDisponibles = new Set(dias.map((d) => d.fecha));
  const hueco = new Map(dias.map((d) => [d.fecha, d.capacidad]));
  const tipoDe = new Map(dias.map((d) => [d.fecha, d.tipo]));
  const porUid = new Map(tareas.map((t) => [t.uid, t]));
  const deps = calcularDependencias(tareas);
  const avisos = [];

  // ¿Se puede mover esta tarea?
  const movible = (t) => t.estado !== 'hecha' && t.tipo !== 'clase' && !t.fijada &&
    (!soloEstas || soloEstas.includes(t.uid));

  // Resultado: día de cada tarea. Las no movibles conservan el suyo y ocupan hueco.
  const asignacion = {};
  for (const t of tareas) {
    if (movible(t)) continue;
    asignacion[t.uid] = t.dia_asignado ?? null;
    if (t.tipo !== 'clase' && fechasDisponibles.has(t.dia_asignado)) {
      // Las hechas solo cuentan si se hicieron ese mismo día (hoy).
      if (t.estado !== 'hecha' || t.hechaEn === t.dia_asignado) {
        hueco.set(t.dia_asignado, hueco.get(t.dia_asignado) - t.minutos);
      }
    }
  }

  const colocada = new Set();     // movibles ya procesadas (con o sin día)
  const enProceso = new Set();    // para evitar bucles

  /** Primer día en que puede ir la tarea según sus dependencias (o null si no se puede). */
  function diaMinimo(t) {
    let minimo = primerDia;
    for (const uidDep of deps.get(t.uid)) {
      const dep = porUid.get(uidDep);
      if (dep.estado === 'hecha') continue;               // ya estudiada: sin restricción
      if (movible(dep) && !colocada.has(uidDep)) colocar(dep);
      const dia = asignacion[uidDep];
      if (dia == null) return null;                        // su estudio no cabe → esta tampoco
      if (dia > minimo) minimo = dia;
    }
    return minimo;
  }

  /** Elige el mejor día de una lista: el sugerido o el más cercano a él (empate: antes). */
  function elegir(candidatos, sugerido) {
    if (!candidatos.length) return null;
    if (!sugerido || sugerido < primerDia) return candidatos[0];
    const dist = (f) => Math.abs(new Date(f) - new Date(sugerido));
    return candidatos.reduce((mejor, f) => (dist(f) < dist(mejor) ? f : mejor));
  }

  function colocar(t) {
    if (colocada.has(t.uid) || enProceso.has(t.uid)) return;
    enProceso.add(t.uid);
    const minimo = diaMinimo(t);
    let dia = null;
    if (minimo != null) {
      const caben = dias.map((d) => d.fecha).filter((f) => f >= minimo && hueco.get(f) >= t.minutos);
      if (esPesada(t)) {
        const libres = caben.filter((f) => tipoDe.get(f) === 'libre');
        dia = elegir(libres, t.dia_sugerido);
        if (!dia) {
          dia = elegir(caben, t.dia_sugerido);
          if (dia) avisos.push(`«${t.titulo}» va en día de TURNO porque no quedan días libres con hueco.`);
        }
      } else {
        dia = elegir(caben, t.dia_sugerido);
      }
    }
    if (dia) hueco.set(dia, hueco.get(dia) - t.minutos);
    asignacion[t.uid] = dia;
    colocada.add(t.uid);
    enProceso.delete(t.uid);
  }

  // --- Orden de procesamiento ---
  const rangoTema = (t) => {
    const i = prioridad.indexOf(t.tema);
    return i < 0 ? prioridad.length : i;
  };
  const esImportante = (t) => (modoMinimos ? t.minimo : t.obligatoria);
  const porSugerido = (a, b) => (a.dia_sugerido || '9999').localeCompare(b.dia_sugerido || '9999') ||
    rangoTema(a) - rangoTema(b) || a.orden - b.orden;
  const porPrioridad = (a, b) => rangoTema(a) - rangoTema(b) || a.orden - b.orden;

  const movibles = tareas.filter(movible);
  const importantes = movibles.filter(esImportante);
  const resto = movibles.filter((t) => !esImportante(t));

  // Importantes: primero pesadas, luego ligeras (así las ligeras no roban los días libres).
  importantes.filter(esPesada).sort(porSugerido).forEach(colocar);
  importantes.filter((t) => !esPesada(t)).sort(porSugerido).forEach(colocar);
  // Resto: por orden de prioridad, solo si queda hueco.
  resto.filter(esPesada).sort(porPrioridad).forEach(colocar);
  resto.filter((t) => !esPesada(t)).sort(porPrioridad).forEach(colocar);

  // --- Avisos de lo que no cabe ---
  const noCabenObligatorias = movibles
    .filter((t) => t.obligatoria && asignacion[t.uid] == null)
    .map((t) => t.uid);
  const noCabenMinimos = movibles.filter((t) => t.minimo && asignacion[t.uid] == null);

  if (noCabenObligatorias.length) {
    const min = noCabenObligatorias.reduce((s, uid) => s + porUid.get(uid).minutos, 0);
    avisos.unshift(`No cabe todo: ${noCabenObligatorias.length} tarea(s) obligatoria(s) sin hueco (${min} min).` +
      (modoMinimos ? '' : ' Te propongo aplicar el plan de mínimos de la academia.'));
  }
  if (modoMinimos && noCabenMinimos.length) {
    avisos.unshift(`Ni siquiera el plan de mínimos cabe entero (${noCabenMinimos.length} tarea(s)). ` +
      'Revisa los días de turno/libre o mueve tareas a mano.');
  }
  return { asignacion, avisos, noCabenObligatorias };
}

/** Ordena las tareas de un día: dependencias primero, luego por tipo y orden de la guía. */
export function ordenarTareasDelDia(tareasDia) {
  return [...tareasDia].sort((a, b) =>
    (a.estado === 'hecha') - (b.estado === 'hecha') ||
    (RANGO_TIPO[a.tipo] ?? 5) - (RANGO_TIPO[b.tipo] ?? 5) ||
    a.orden - b.orden);
}
