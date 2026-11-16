// =====================================================================
// bienvenida.js — Asistente de la primera vez (4 pasos).
// Se muestra solo si la app está recién instalada y sin datos.
// =====================================================================
import { ajustes, cambiarAjustes } from './ajustes.js';
import { datos } from './db.js';
import { hoyISO } from './fechas.js';
import { secuenciaDesde } from './turnos.js';

export function hayQueMostrarBienvenida() {
  const a = ajustes();
  return !a.bienvenidaHecha && !a.patron && !datos.semanas.length;
}

/** Muestra el asistente. Devuelve una promesa que se resuelve al terminar. */
export function mostrarBienvenida() {
  return new Promise((resolver) => {
    const a = ajustes();
    const r = { examen: '', inicio: hoyISO(), t: 4, l: 3, turno: a.minutosTurno, libre: a.minutosLibre, minimo: a.minimoMinutos };
    let paso = 0;
    const capa = document.createElement('div');
    capa.className = 'bienvenida';
    document.body.appendChild(capa);

    const PASOS = [
      () => `
        <div class="bv-emoji">🔥</div>
        <h1>Abre. Mira. Estudia.</h1>
        <p>Esta app decide por ti qué toca cada día según tus <b>turnos</b>.
          Tú solo tienes que abrirla y pulsar <b>Empezar</b>.</p>
        <label class="campo"><span>¿Sabes la fecha del examen? (opcional)</span>
          <input type="date" name="examen" value="${r.examen}"></label>`,
      () => `
        <div class="bv-emoji">📅</div>
        <h1>Tus turnos</h1>
        <p>Dime cómo es tu ciclo. Luego podrás corregir días sueltos en el Calendario.</p>
        <label class="campo"><span>Primer día de TURNO del ciclo</span>
          <input type="date" name="inicio" value="${r.inicio}"></label>
        <div class="dos-columnas">
          <label class="campo"><span>Días de turno</span><input type="number" name="t" min="0" inputmode="numeric" value="${r.t}"></label>
          <label class="campo"><span>Días libres</span><input type="number" name="l" min="0" inputmode="numeric" value="${r.l}"></label>
        </div>`,
      () => `
        <div class="bv-emoji">⏱️</div>
        <h1>Tu tiempo</h1>
        <p>¿Cuánto puedes dedicar como máximo? Siendo realista: mejor poco y cada día.</p>
        <label class="campo fila"><span>Día de TURNO (min)</span><input type="number" name="turno" inputmode="numeric" value="${r.turno}"></label>
        <label class="campo fila"><span>Día LIBRE (min)</span><input type="number" name="libre" inputmode="numeric" value="${r.libre}"></label>
        <label class="campo fila"><span>Mínimo diario para la racha (min)</span><input type="number" name="minimo" inputmode="numeric" value="${r.minimo}"></label>`,
      () => `
        <div class="bv-emoji">✅</div>
        <h1>¡Listo!</h1>
        <p>Último paso: carga la guía de esta semana. En la pantalla <b>Semana</b> tienes un botón
          para <b>copiar las instrucciones</b> que le pasas a la IA junto con el PDF de la academia.</p>`,
    ];

    function leer() {
      const f = capa.querySelector('form');
      ['examen', 'inicio', 't', 'l', 'turno', 'libre', 'minimo'].forEach((k) => {
        if (f[k]) r[k] = f[k].type === 'number' ? Number(f[k].value) || 0 : f[k].value;
      });
    }

    function pintar() {
      capa.innerHTML = `<form class="bv-tarjeta">
        <div class="bv-puntos">${PASOS.map((_, i) => `<i class="${i === paso ? 'activo' : ''}"></i>`).join('')}</div>
        ${PASOS[paso]()}
        <div class="bv-botones">
          ${paso > 0 ? '<button type="button" class="boton" data-acc="atras">Atrás</button>' : '<span></span>'}
          ${paso < PASOS.length - 1
            ? '<button class="boton primario" data-acc="siguiente">Siguiente →</button>'
            : '<button class="boton primario" data-acc="fin">Cargar la guía →</button>'}
        </div></form>`;
    }

    capa.addEventListener('click', async (e) => {
      const acc = e.target.closest('[data-acc]')?.dataset.acc;
      if (!acc) return;
      e.preventDefault();
      leer();
      if (acc === 'atras') { paso--; pintar(); }
      if (acc === 'siguiente') { paso++; pintar(); }
      if (acc === 'fin') {
        await cambiarAjustes({
          bienvenidaHecha: true,
          fechaExamen: r.examen || null,
          patron: r.t + r.l > 0 ? { inicio: r.inicio, secuencia: secuenciaDesde(r.t, r.l) } : null,
          minutosTurno: r.turno || 45, minutosLibre: r.libre || 210, minimoMinutos: r.minimo || 20,
        });
        capa.remove();
        location.hash = '#/semana';
        resolver();
      }
    });
    pintar();
  });
}
