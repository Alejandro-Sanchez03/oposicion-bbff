// =====================================================================
// fechas.js — Utilidades de fechas.
// Todas las fechas de la app se guardan como texto "AAAA-MM-DD" (ISO),
// en hora local. Así se comparan fácilmente ("2026-11-13" < "2026-11-14").
// =====================================================================

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Convierte un objeto Date a "AAAA-MM-DD" (hora local). */
export function aISO(fecha) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

/** Convierte "AAAA-MM-DD" a Date (a mediodía, para evitar líos con el cambio de hora). */
export function deISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d, 12, 0, 0);
}

/** Fecha de hoy en "AAAA-MM-DD". */
export function hoyISO() {
  return aISO(new Date());
}

/** Suma (o resta) días a una fecha ISO. */
export function sumarDias(iso, n) {
  const f = deISO(iso);
  f.setDate(f.getDate() + n);
  return aISO(f);
}

/** Días entre dos fechas ISO (b - a). */
export function diferenciaDias(a, b) {
  return Math.round((deISO(b) - deISO(a)) / 86400000);
}

/** Día de la semana: 0 = domingo ... 6 = sábado. */
export function diaSemana(iso) {
  return deISO(iso).getDay();
}

/** Lista de fechas ISO entre a y b, ambas incluidas. */
export function rangoFechas(a, b) {
  const lista = [];
  for (let f = a; f <= b; f = sumarDias(f, 1)) lista.push(f);
  return lista;
}

/** Viernes en que empieza la "semana de academia" (viernes a jueves) de una fecha. */
export function inicioSemanaAcademia(iso) {
  const retroceso = (diaSemana(iso) - 5 + 7) % 7; // 5 = viernes
  return sumarDias(iso, -retroceso);
}

/** "lunes 16 de noviembre" */
export function textoLargo(iso) {
  const f = deISO(iso);
  return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}

/** "Lun 16" */
export function textoCorto(iso) {
  const f = deISO(iso);
  return `${DIAS_CORTOS[f.getDay()]} ${f.getDate()}`;
}

/** "noviembre 2026" */
export function textoMes(anio, mes) {
  return `${MESES[mes]} ${anio}`;
}

/** Comprueba que un texto es una fecha "AAAA-MM-DD" válida. */
export function esFechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  return aISO(deISO(texto)) === texto;
}

export { DIAS, DIAS_CORTOS, MESES };
