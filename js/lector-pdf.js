// =====================================================================
// lector-pdf.js — Lee el PDF de la guía de la academia y lo convierte
// en la guía de la app. GRATIS y SIN INTERNET (no usa IA).
//
// Funciona con el formato de la Academia 750: una tabla con los días en
// columnas (V-13, S-14 ... J-19) y dos filas: "TRABAJO OBLIGATORIO" y
// "TRABAJO OPCIONAL". Cada tarea de una casilla empieza por "-".
// También lee "Orden de prioridad: A > B > C" y la "Nota:" que va debajo.
//
// Si la academia cambia el formato, lo más probable es que haya que
// ajustar las listas de palabras de aquí abajo.
// =====================================================================
import { aISO, deISO, sumarDias, diferenciaDias, diaSemana, MESES } from './fechas.js';

// ---------- Palabras que la app reconoce (puedes añadir más) ----------

/** Minutos que se ponen por defecto a cada tipo (el PDF no los indica). Se pueden cambiar antes de importar. */
export const MINUTOS_POR_DEFECTO = { estudio: 90, autoevaluacion: 30, test: 30, repaso: 30, psicotecnico: 30, clase: 0 };

/** Abreviaturas que usa la academia en la tabla → palabra completa. */
const ABREVIATURAS = {
  'COMUNICAC': 'Comunicaciones', 'COMUNICAC.': 'Comunicaciones', 'COMUNIC.': 'Comunicaciones',
  'HERRAM.': 'Herramientas', 'AUTOEVAL.': 'Autoevaluación', 'AUTOEVAL': 'Autoevaluación',
  'EJERC.': 'Ejercicios', 'PSICOT.': 'Psicotécnico',
};
/** Siglas que se dejan en mayúsculas. */
const SIGLAS = ['FT', 'PEIF', 'PTECV', 'SGISE', 'SBF', 'PE', 'PH', 'CV', 'EPI', 'EPIS', 'GVA', 'DL'];
/** Palabras que indican un ejercicio psicotécnico. */
const PSICO = ['APTITUD', 'ANTÓNIMO', 'ANTONIMO', 'SINÓNIMO', 'SINONIMO', 'PSICOT', 'RAZONAMIENTO', 'SERIES',
  'MEMORIA', 'ORTOGRAF', 'VERBAL', 'ESPACIAL', 'ABSTRACT', 'MECÁNIC', 'MECANIC', 'PERCEPTIV', 'CÁLCULO', 'CALCULO'];
/** Palabra inicial → tipo de tarea. */
const VERBOS = [
  [/^ESTUDI(O|AR)\b\.?/, 'estudio'],
  [/^AUTOEVAL(UACI[ÓO]N|\.)?/, 'autoevaluacion'],
  [/^REPAS(O|AR)\b\.?/, 'repaso'],
  [/^EJERCICIOS?\b\.?/, 'ejercicios'],
  [/^(TEST|EXAMEN)\b/, 'test'],
  [/^(LECTURA|LEER)\b/, 'estudio'],
];

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------- 1) Sacar el texto del PDF (con su posición en la página) ----------

/** Devuelve una lista de trozos de texto: { p: página, x, y, w: ancho, s: texto }. */
export async function leerTextoPDF(buffer) {
  const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, verbosity: 0 }).promise;
  const items = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const contenido = await (await doc.getPage(p)).getTextContent();
    for (const it of contenido.items) {
      if (it.str && it.str.trim()) items.push({ p, x: it.transform[4], y: it.transform[5], w: it.width, s: it.str });
    }
  }
  return items;
}

// ---------- 2) Reconstruir líneas y palabras ----------

/** Agrupa trozos en líneas (misma página y altura). Devuelve [{ p, y, palabras:[{s,x0,x1}], texto }]. */
function lineas(items) {
  const orden = [...items].sort((a, b) => a.p - b.p || b.y - a.y || a.x - b.x);
  const res = [];
  for (const it of orden) {
    const ult = res[res.length - 1];
    if (ult && ult.p === it.p && Math.abs(ult.y - it.y) <= 3) ult.trozos.push(it);
    else res.push({ p: it.p, y: it.y, trozos: [it] });
  }
  for (const l of res) {
    l.trozos.sort((a, b) => a.x - b.x);
    l.palabras = [];
    for (const t of l.trozos) {
      const prev = l.palabras[l.palabras.length - 1];
      // Si el trozo empieza pegado al anterior, es la misma palabra ("C" + "omunicaciones").
      if (prev && t.x - prev.x1 < 1.5) { prev.s += t.s; prev.x1 = t.x + t.w; }
      else l.palabras.push({ s: t.s, x0: t.x, x1: t.x + t.w });
    }
    l.texto = l.palabras.map((p) => p.s.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }
  return res;
}

// ---------- 3) Entender la tabla ----------

/** "FT COMUNICAC." → "FT Comunicaciones"; "LEY 13/2010" → "Ley 13/2010". */
function bonito(texto) {
  return texto.split(/\s+/).filter(Boolean).map((w) => {
    const W = w.toUpperCase();
    if (ABREVIATURAS[W]) return ABREVIATURAS[W];
    const limpio = W.replace(/[.,;:]$/, '');
    if (SIGLAS.includes(limpio)) return limpio;
    if (/\d/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ').replace(/[.,;:]+$/, '');
}

/** Convierte el texto de una casilla ("ESTUDIO FT COMUNICAC.") en { tipo, tema, titulo } o null (descanso). */
function interpretar(texto) {
  const T = texto.replace(/^[-–•®·\s]+/, '').trim();
  const U = T.toUpperCase();
  if (!T || /^DESCANSO/.test(U)) return null;
  if (/CLASE/.test(U)) {
    // "TEST CLASE 50P" → "Test en clase (50 preguntas)"; "CLASE 17:00 a 20:00" → "Clase 17:00–20:00"
    const n = /(\d+)\s*P\b/.exec(U);
    if (/TEST|EXAMEN/.test(U)) return { tipo: 'clase', tema: 'Academia', titulo: `Test en clase${n ? ` (${n[1]} preguntas)` : ''}` };
    return { tipo: 'clase', tema: 'Academia', titulo: bonito(T).replace(/(\d{1,2}:\d{2}) A (\d{1,2}:\d{2})/i, '$1–$2') };
  }
  const esPsico = PSICO.some((p) => U.includes(p));
  let tipo = null, resto = T;
  for (const [re, t] of VERBOS) {
    const m = re.exec(U);
    if (m) { tipo = t; resto = T.slice(m[0].length).trim(); break; }
  }
  if (esPsico) {
    // "EJERCICIOS APTITUD NUMÉRICA 01" → "Aptitud numérica 01"
    const nombre = bonito(resto || T);
    return { tipo: 'psicotecnico', tema: 'Psicotécnico', titulo: nombre.charAt(0) + nombre.slice(1).toLowerCase() };
  }
  const tema = bonito(resto || T);
  if (tipo === 'ejercicios') return { tipo: 'repaso', tema, titulo: `Ejercicios ${tema}` };
  const t = tipo || 'estudio';
  const prefijo = { estudio: 'Estudiar', autoevaluacion: 'Autoevaluación', repaso: 'Repaso', test: 'Test' }[t];
  return { tipo: t, tema, titulo: `${prefijo} ${tema}` };
}

/** Elige la fecha del viernes: el más cercano a hoy cuyo día del mes coincide con el de la tabla. */
function fechaDelViernes(diaV, mesTexto, hoy) {
  let mejor = null;
  // Busca hasta ~1 año atrás (para cargar guías antiguas) y 2 meses adelante.
  for (let d = -400; d <= 60; d++) {
    const f = sumarDias(hoy, d);
    if (diaSemana(f) !== 5 || deISO(f).getDate() !== diaV) continue;
    // Si el PDF nombra el mes, la semana tiene que tocar ese mes.
    if (mesTexto != null && deISO(f).getMonth() !== mesTexto && deISO(sumarDias(f, 6)).getMonth() !== mesTexto) continue;
    if (!mejor || Math.abs(d) < Math.abs(diferenciaDias(hoy, mejor))) mejor = f;
  }
  return mejor;
}

/**
 * Analiza los trozos de texto del PDF.
 * @returns {{ guia: object, avisos: string[] } | { error: string }}
 */
export function analizarGuia(items, hoy = aISO(new Date()), minutos = MINUTOS_POR_DEFECTO) {
  const todas = lineas(items);

  // a) Cabecera de días: "V-13 S-14 D-15 L-16 M-17 X-18 J-19"
  let cabecera = null, columnas = [];
  for (const l of todas) {
    const dias = l.palabras
      .map((p) => ({ ...p, m: /^([LMXJVSD])\s*-\s*(\d{1,2})$/.exec(p.s.trim()) }))
      .filter((p) => p.m);
    if (dias.length >= 5) { cabecera = l; columnas = dias.map((d) => ({ letra: d.m[1], dia: Number(d.m[2]), x: (d.x0 + d.x1) / 2 })); break; }
  }
  if (!cabecera) return { error: 'No encuentro la tabla con los días (V-13, S-14…). ¿Es la guía semanal de la academia?' };
  if (columnas[0].letra !== 'V') return { error: 'La tabla no empieza en viernes; no sé interpretarla.' };

  // b) Fecha real de cada columna
  const textoTodo = todas.map((l) => l.texto).join(' ').toLowerCase();
  const mes = MESES.findIndex((m) => textoTodo.includes(m));
  const viernes = fechaDelViernes(columnas[0].dia, mes >= 0 ? mes : null, hoy);
  if (!viernes) return { error: `No sé a qué fecha corresponde el viernes ${columnas[0].dia}.` };
  columnas.forEach((c) => {
    const offset = 'VSDLMXJ'.indexOf(c.letra);
    c.fecha = sumarDias(viernes, offset);
  });
  const jueves = sumarDias(viernes, 6);

  // c) Filas: obligatorio / opcional
  const misma = todas.filter((l) => l.p === cabecera.p && l.y < cabecera.y - 2);
  const yObl = misma.find((l) => /TRABAJO\s+OBLIGATORIO/i.test(l.texto))?.y ?? cabecera.y;
  const yOpc = misma.find((l) => /TRABAJO\s+OPCIONAL/i.test(l.texto))?.y ?? null;
  const fueraDeTabla = (l) => /TRABAJO\s+(OBLIGATORIO|OPCIONAL)/i.test(l.texto);

  // Las líneas de la fila opcional terminan donde hay un hueco grande (fin de la tabla).
  let limiteOpc = -Infinity;
  if (yOpc != null) {
    const ys = misma.filter((l) => l.y < yOpc - 2).map((l) => l.y);
    limiteOpc = ys.length ? ys[ys.length - 1] - 1 : yOpc;
    for (let i = 1; i < ys.length; i++) if (ys[i - 1] - ys[i] > 45) { limiteOpc = ys[i - 1] - 1; break; }
  }

  /** Reparte los trozos de unas líneas entre las columnas y los une en tareas. */
  function leerFila(lineasFila, obligatoria) {
    const porColumna = columnas.map(() => []);
    for (const l of lineasFila) {
      for (const p of l.palabras) {
        const centro = (p.x0 + p.x1) / 2;
        let i = 0;
        columnas.forEach((c, j) => { if (Math.abs(c.x - centro) < Math.abs(columnas[i].x - centro)) i = j; });
        const celda = porColumna[i];
        const ult = celda[celda.length - 1];
        if (ult && Math.abs(ult.y - l.y) <= 3) ult.texto += ' ' + p.s.trim();
        else celda.push({ y: l.y, texto: p.s.trim() });
      }
    }
    const tareas = [];
    porColumna.forEach((celda, i) => {
      const entradas = [];
      for (const linea of celda) {
        const t = linea.texto.replace(/\s+/g, ' ').trim();
        if (/^[-–•®·]/.test(t) || !entradas.length) entradas.push(t);
        else entradas[entradas.length - 1] += ' ' + t; // continuación de la línea anterior
      }
      for (const e of entradas) {
        const r = interpretar(e);
        if (r) tareas.push({ ...r, obligatoria, dia: columnas[i].fecha, original: e.replace(/^[-–•®·\s]+/, '') });
      }
    });
    return tareas;
  }

  const filaObl = misma.filter((l) => l.y < yObl - 2 && (yOpc == null || l.y > yOpc + 2) && !fueraDeTabla(l));
  const filaOpc = yOpc == null ? [] : misma.filter((l) => l.y < yOpc - 2 && l.y > limiteOpc && !fueraDeTabla(l));
  const tareas = [...leerFila(filaObl, true), ...leerFila(filaOpc, false)]
    .sort((a, b) => a.dia.localeCompare(b.dia) || (b.obligatoria - a.obligatoria));
  if (!tareas.length) return { error: 'He encontrado la tabla pero no he sabido leer ninguna tarea.' };

  // d) Unificar temas: "Comunicaciones" y "FT Comunicaciones" son el mismo (se queda el nombre más largo)
  const raizTema = (s) => sinTildes(s.toLowerCase()).split(/\s+/).map((w) => w.replace(/[^a-z0-9/]/g, '')).filter((w) => w.length >= 3);
  const nombres = [...new Set(tareas.filter((t) => t.tipo !== 'clase').map((t) => t.tema))];
  for (const t of tareas) {
    if (t.tipo === 'clase') continue;
    const mio = raizTema(t.tema);
    const mayor = nombres.find((o) => o !== t.tema && o.length > t.tema.length && mio.length &&
      mio.every((w) => raizTema(o).includes(w)));
    if (mayor) {
      t.titulo = t.titulo.replace(t.tema, mayor);
      t.tema = mayor;
    }
  }

  // e) Numerar tareas repetidas: "Estudiar FT Comunicaciones (1/4)"
  const cuenta = {};
  tareas.forEach((t) => { cuenta[t.titulo] = (cuenta[t.titulo] || 0) + 1; });
  const vista = {};
  tareas.forEach((t) => {
    if (cuenta[t.titulo] > 1 && t.tipo !== 'clase') { vista[t.titulo] = (vista[t.titulo] || 0) + 1; t.titulo += ` (${vista[t.titulo]}/${cuenta[t.titulo]})`; }
  });

  // f) Orden de prioridad: "Comunicaciones > Psicotécnicos > Trabajo secundario de repaso"
  const avisos = [];
  const temas = [...new Set(tareas.filter((t) => t.tipo !== 'clase').map((t) => t.tema))];
  const raiz = (s) => sinTildes(s.toLowerCase()).replace(/[^a-z0-9]/g, '').slice(0, 7);
  let prioridad = [];
  const iPrio = todas.findIndex((l) => /orden de prioridad/i.test(l.texto));
  if (iPrio >= 0) {
    const resto = todas[iPrio].texto.replace(/.*orden de prioridad:?/i, '').trim();
    const linea = resto.includes('>') ? resto : (todas[iPrio + 1]?.texto || '');
    for (const parte of linea.split(/>|→/).map((s) => s.trim()).filter(Boolean)) {
      const palabras = parte.split(/\s+/).map(raiz).filter((w) => w.length >= 4);
      let encontrados = temas.filter((t) => !prioridad.includes(t) &&
        t.split(/\s+/).map(raiz).some((w) => palabras.includes(w)));
      // "Trabajo secundario de repaso" → los temas de repaso que queden
      if (!encontrados.length && /repaso|secundari/i.test(parte)) {
        encontrados = temas.filter((t) => !prioridad.includes(t) &&
          tareas.some((x) => x.tema === t && x.tipo === 'repaso'));
      }
      prioridad.push(...encontrados);
    }
  }
  if (!prioridad.length) avisos.push('No he encontrado el «Orden de prioridad»: pongo primero lo obligatorio.');
  // Los temas que falten: primero los de lo obligatorio
  const obligTemas = temas.filter((t) => tareas.some((x) => x.tema === t && x.obligatoria));
  prioridad = [...new Set([...prioridad, ...obligTemas, ...temas])];

  // g) Nota → plan de mínimos
  let nota = '';
  const iNota = todas.findIndex((l) => /^nota:/i.test(l.texto));
  if (iNota >= 0) {
    nota = todas[iNota].texto.replace(/^nota:\s*/i, '');
    for (let i = iNota + 1; i < todas.length && todas[i].p === todas[iNota].p && todas[i - 1].y - todas[i].y < 22; i++) nota += ' ' + todas[i].texto;
  }
  const principal = prioridad[0];
  const planMinimo = `Céntrate en ${principal}.${nota ? ` ${nota}` : ''}`;

  // h) Hora de la clase del jueves
  const clase = tareas.find((t) => t.tipo === 'clase' && /\d{1,2}:\d{2}/.test(t.titulo));
  const hora = clase ? (/(\d{1,2}):(\d{2})/.exec(clase.titulo)) : null;
  const horaLimite = hora ? `${hora[1].padStart(2, '0')}:${hora[2]}` : '17:00';

  const guia = {
    semana: `${viernes} a ${jueves}`,
    fecha_limite: `${jueves}T${horaLimite}`,
    prioridad,
    plan_minimo: planMinimo,
    tareas: tareas.map((t, i) => ({
      id: `t${i + 1}`, titulo: t.titulo, tema: t.tema, tipo: t.tipo, obligatoria: t.obligatoria,
      dia_sugerido: t.dia, minutos: t.tipo === 'clase' ? 0 : (minutos[t.tipo] ?? MINUTOS_POR_DEFECTO[t.tipo] ?? 30),
      minimo: t.obligatoria && t.tema === principal,
    })),
  };
  avisos.push('El PDF no dice cuánto dura cada tarea: he puesto minutos estimados. Revísalos antes de importar.');
  return { guia, avisos };
}
