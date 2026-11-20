// =====================================================================
// notas.js — Apuntar la nota de un test (en clase, autoevaluación, simulacro...).
// Se usa desde HOY (al terminar un test) y desde Progreso → Temario.
// =====================================================================
import { datos, guardar, nuevoId } from './db.js';
import { ajustes, cambiarAjustes } from './ajustes.js';
import { hoyISO } from './fechas.js';
import { dialogo, esc, toast } from './ui.js';

/** Nota sobre 10 con penalización: (aciertos − fallos/N) / total × 10. */
export function calcularNota(aciertos, fallos, blanco, penalizacion = ajustes().penalizacion) {
  const total = aciertos + fallos + blanco;
  if (!total) return 0;
  const netos = aciertos - (penalizacion > 0 ? fallos / penalizacion : 0);
  return Math.max(0, Math.round((netos / total) * 1000) / 100);
}

/**
 * Ventana para apuntar una nota. Pide nº de preguntas, aciertos y fallos;
 * las preguntas en blanco y la nota se calculan solas.
 * @param {object} op { tema, titulo, fecha, tareaUid }
 * @returns el test guardado o null
 */
export async function dialogoNota({ tema = '', titulo = '✍️ Apuntar la nota de un test', fecha = hoyISO(), tareaUid = null, preguntas: nPreg = null } = {}) {
  const a = ajustes();
  const temas = [...new Set([...datos.temas.map((t) => t.nombre), ...datos.tests.map((t) => t.tema)])];
  const preguntas = nPreg || a.ultimasPreguntas || 50;
  const r = await dialogo(`
    <h3>${esc(titulo)}</h3>
    <label class="campo"><span>Tema</span><input name="tema" list="dn-temas" value="${esc(tema)}" placeholder="FT Comunicaciones"></label>
    <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${fecha}"></label>
    <datalist id="dn-temas">${temas.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="tres-columnas">
      <label class="campo"><span>Preguntas</span><input type="number" name="total" min="1" inputmode="numeric" value="${preguntas}"></label>
      <label class="campo"><span>Aciertos</span><input type="number" name="ac" min="0" inputmode="numeric"></label>
      <label class="campo"><span>Fallos</span><input type="number" name="fa" min="0" inputmode="numeric" value="0"></label>
    </div>
    <p class="nota-calculada">En blanco: <b data-blanco>—</b> · Nota: <b data-nota>—</b></p>
    <p class="ayuda">${a.penalizacion ? `Cada ${a.penalizacion} fallos restan un acierto (se cambia en Ajustes).` : 'Los fallos no restan (se cambia en Ajustes).'}</p>`,
  [{ texto: 'Cancelar', valor: false }, { texto: 'Guardar nota', valor: true, clase: 'primario' }],
  (form, ok) => {
    if (!ok || form.ac.value === '' || !form.tema.value.trim()) return null;
    const total = Number(form.total.value) || 0;
    const ac = Number(form.ac.value) || 0;
    const fa = Number(form.fa.value) || 0;
    return { tema: form.tema.value.trim(), fecha: form.fecha.value || hoyISO(), total, ac, fa, bl: Math.max(0, total - ac - fa) };
  }, (d) => {
    // Cálculo en directo mientras escribes
    const f = d.querySelector('form');
    const calc = () => {
      const total = Number(f.total.value) || 0, ac = Number(f.ac.value) || 0, fa = Number(f.fa.value) || 0;
      const bl = Math.max(0, total - ac - fa);
      d.querySelector('[data-blanco]').textContent = f.ac.value === '' ? '—' : bl;
      d.querySelector('[data-nota]').textContent = f.ac.value === '' ? '—' : calcularNota(ac, fa, bl).toFixed(2).replace('.', ',');
    };
    f.addEventListener('input', calc);
  });
  if (!r) return null;
  const test = {
    id: nuevoId(), fecha: r.fecha, tema: r.tema, aciertos: r.ac, fallos: r.fa, blanco: r.bl,
    nota: calcularNota(r.ac, r.fa, r.bl), creado: new Date().toISOString(), tareaUid,
  };
  await guardar('tests', test);
  await cambiarAjustes({ ultimasPreguntas: r.total });
  toast(`Nota guardada: ${test.nota.toFixed(2).replace('.', ',')}`);
  return test;
}
