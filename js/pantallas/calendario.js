// =====================================================================
// Pantalla CALENDARIO — turnos (TURNO/LIBRE) y racha en una sola vista.
// Toca un día para cambiarlo entre TURNO y LIBRE.
// =====================================================================
import { ajustes, cambiarAjustes } from '../ajustes.js';
import { aISO, hoyISO, textoMes, diaSemana, deISO } from '../fechas.js';
import { tipoDia, esManual, alternarDia, secuenciaDesde } from '../turnos.js';
import { estadoDia, rachaActual, mejorRacha } from '../racha.js';
import { dialogo, toast, esc } from '../ui.js';
import { datos } from '../db.js';
import { repartirSemana } from '../guia.js';

let anio = null, mes = null; // mes que se está viendo

const MARCA = { cumplido: '✗', comodin: '🃏', fallado: '·' };

export function render(cont, app) {
  if (anio === null) { const h = deISO(hoyISO()); anio = h.getFullYear(); mes = h.getMonth(); }
  const hoy = hoyISO();
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const huecosIniciales = (diaSemana(aISO(new Date(anio, mes, 1, 12))) + 6) % 7; // semana empieza en lunes
  let turnos = 0, libres = 0;

  let celdas = '<div class="cal-cabecera">L</div><div class="cal-cabecera">M</div><div class="cal-cabecera">X</div>' +
    '<div class="cal-cabecera">J</div><div class="cal-cabecera">V</div><div class="cal-cabecera">S</div><div class="cal-cabecera">D</div>';
  celdas += '<div></div>'.repeat(huecosIniciales);
  for (let d = 1; d <= diasMes; d++) {
    const f = aISO(new Date(anio, mes, d, 12));
    const tipo = tipoDia(f);
    if (tipo === 'turno') turnos++; else if (tipo === 'libre') libres++;
    const est = estadoDia(f);
    celdas += `<button class="cal-dia ${tipo || 'nada'} ${f === hoy ? 'es-hoy' : ''} est-${est}" data-fecha="${f}"
      aria-label="${f} ${tipo || 'sin definir'} ${est}">
      <span class="cal-num">${d}${esManual(f) ? '<sup>✎</sup>' : ''}</span>
      <span class="cal-tipo">${tipo === 'turno' ? 'T' : tipo === 'libre' ? 'L' : ''}</span>
      <span class="cal-marca">${MARCA[est] || ''}</span></button>`;
  }

  const p = ajustes().patron;
  cont.innerHTML = `
    <h1>Calendario</h1>
    <section class="tarjeta racha-resumen">
      <div><b>🔥 ${rachaActual()}</b><small>racha actual</small></div>
      <div><b>🏆 ${mejorRacha()}</b><small>mejor racha</small></div>
    </section>
    <div class="cal-nav">
      <button class="boton icono" data-acc="mes" data-dir="-1" aria-label="Mes anterior">◀</button>
      <h2>${textoMes(anio, mes)}</h2>
      <button class="boton icono" data-acc="mes" data-dir="1" aria-label="Mes siguiente">▶</button>
    </div>
    <div class="calendario">${celdas}</div>
    <p class="leyenda">
      <span class="etiqueta-dia mini turno">T = TURNO</span>
      <span class="etiqueta-dia mini libre">L = LIBRE</span>
      ✗ cumplido · 🃏 comodín · ✎ corregido a mano</p>
    <p>Este mes: <b>${turnos}</b> días de turno y <b>${libres}</b> libres.</p>
    <p class="ayuda">Toca un día para cambiarlo entre TURNO y LIBRE.</p>
    <section class="tarjeta">
      <h3>Patrón de turnos</h3>
      <p>${p ? `Actual: <b>${p.secuencia}</b> desde el ${p.inicio}` : 'Aún no has definido un patrón.'}</p>
      <button class="boton primario" data-acc="patron">⚙ Definir patrón</button>
    </section>`;

  cont.onclick = async (e) => {
    const dia = e.target.closest('[data-fecha]');
    if (dia) {
      await alternarDia(dia.dataset.fecha);
      await repartirSemanasAfectadas(dia.dataset.fecha);
      app.refrescar();
      return;
    }
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    if (b.dataset.acc === 'mes') {
      mes += Number(b.dataset.dir);
      if (mes < 0) { mes = 11; anio--; } else if (mes > 11) { mes = 0; anio++; }
      app.refrescar();
    }
    if (b.dataset.acc === 'patron') {
      const r = await dialogoPatron();
      if (r) {
        await cambiarAjustes({ patron: r });
        await repartirSemanasAfectadas();
        toast('Patrón guardado');
        app.refrescar();
      }
    }
  };
}

/** Al cambiar turnos, se vuelve a repartir la semana afectada (sin tocar lo movido a mano). */
async function repartirSemanasAfectadas(fecha = null) {
  const hoy = hoyISO();
  for (const s of datos.semanas.filter((x) => x.fin >= hoy && (!fecha || (x.inicio <= fecha && fecha <= x.fin)))) {
    await repartirSemana(s.id);
  }
}

function dialogoPatron() {
  const p = ajustes().patron;
  const t = p ? (p.secuencia.match(/^T+/) || [''])[0].length : 4;
  const l = p ? p.secuencia.length - t : 3;
  const simple = !p || p.secuencia === secuenciaDesde(t, l);
  return dialogo(`
    <h3>Patrón de turnos</h3>
    <label class="campo"><span>Primer día de TURNO del ciclo</span>
      <input type="date" name="inicio" value="${p ? p.inicio : hoyISO()}"></label>
    <div class="dos-columnas">
      <label class="campo"><span>Días de turno</span><input type="number" name="t" min="0" inputmode="numeric" value="${t}"></label>
      <label class="campo"><span>Días libres</span><input type="number" name="l" min="0" inputmode="numeric" value="${l}"></label>
    </div>
    <details ${simple ? '' : 'open'}><summary>Patrón avanzado (opcional)</summary>
      <label class="campo"><span>Secuencia con T (turno) y L (libre). Si la rellenas, manda sobre lo de arriba.
        Ej: TTTTLLLTTTLLLL</span>
        <input name="sec" value="${simple ? '' : esc(p.secuencia)}" autocapitalize="characters"></label>
    </details>
    <p class="ayuda">Los días que hayas corregido a mano se respetan.</p>`,
  [{ texto: 'Cancelar', valor: false }, { texto: 'Guardar', valor: true, clase: 'primario' }],
  (form, ok) => {
    if (!ok) return null;
    const sec = form.sec.value.toUpperCase().replace(/[^TL]/g, '');
    const secuencia = sec || secuenciaDesde(Number(form.t.value) || 0, Number(form.l.value) || 0);
    if (!secuencia || !form.inicio.value) return null;
    return { inicio: form.inicio.value, secuencia };
  });
}
