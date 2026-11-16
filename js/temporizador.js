// =====================================================================
// temporizador.js — Temporizador tipo pomodoro a pantalla completa.
// Estudio (25 min) → descanso (5 min) → estudio... (configurable en Ajustes).
// Usa la hora real del reloj, así que aunque la pantalla se apague
// el tiempo sigue contando bien.
// =====================================================================
import { ajustes } from './ajustes.js';
import { esc } from './ui.js';

let wakeLock = null;

/** Pitido corto + vibración al cambiar de fase. */
function avisoSonoro() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = 880;
      vol.gain.setValueAtTime(0.25, ctx.currentTime + t);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
  } catch { /* sin sonido, no pasa nada */ }
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
}

const mmss = (seg) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(Math.floor(seg % 60)).padStart(2, '0')}`;

/**
 * Abre el temporizador.
 * @param {object|null} tarea  Tarea en la que vas a trabajar (o null = estudio libre).
 * @param {function} alTerminar  Recibe los minutos estudiados al pulsar "Terminar".
 */
export function abrirTemporizador(tarea, alTerminar) {
  const a = ajustes();
  const DUR = { estudio: a.pomodoroEstudio * 60, descanso: a.pomodoroDescanso * 60 };

  const estado = {
    fase: 'estudio',          // 'estudio' o 'descanso'
    enMarcha: true,
    finEn: Date.now() + DUR.estudio * 1000,  // momento en que acaba la fase
    restantePausa: null,      // segundos que quedaban al pausar
    estudiado: 0,             // segundos de estudio ya acumulados
    inicioTramo: Date.now(),  // desde cuándo se está contando estudio
    bloques: 0,
  };

  const capa = document.createElement('div');
  capa.className = 'temporizador';
  document.body.appendChild(capa);
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wakeLock = w; }).catch(() => {});

  const restante = () => (estado.enMarcha ? Math.max(0, (estado.finEn - Date.now()) / 1000) : estado.restantePausa);

  /** Suma al contador el tramo de estudio en curso. */
  function cerrarTramo() {
    if (estado.fase === 'estudio' && estado.enMarcha) estado.estudiado += (Date.now() - estado.inicioTramo) / 1000;
    estado.inicioTramo = Date.now();
  }

  function cambiarFase(nueva, arrancar) {
    cerrarTramo();
    if (estado.fase === 'estudio' && nueva === 'descanso') estado.bloques++;
    estado.fase = nueva;
    estado.enMarcha = arrancar;
    estado.finEn = Date.now() + DUR[nueva] * 1000;
    estado.restantePausa = DUR[nueva];
    estado.inicioTramo = Date.now();
    pintar();
  }

  function pintar() {
    const totalMin = Math.floor((estado.estudiado + (estado.fase === 'estudio' && estado.enMarcha ? (Date.now() - estado.inicioTramo) / 1000 : 0)) / 60);
    capa.className = `temporizador fase-${estado.fase}`;
    capa.innerHTML = `
      <div class="temp-tarea">${tarea ? esc(tarea.titulo) : 'Estudio libre'}</div>
      <div class="temp-fase">${estado.fase === 'estudio' ? '📖 ESTUDIO' : '☕ DESCANSO'}</div>
      <div class="temp-reloj" aria-live="polite">${mmss(restante())}</div>
      <div class="temp-info">Llevas ${totalMin} min de estudio · ${estado.bloques} bloque(s)</div>
      <div class="temp-botones">
        <button class="boton grande" data-acc="pausa">${estado.enMarcha ? '⏸ Pausa' : '▶ Seguir'}</button>
        <button class="boton grande" data-acc="fase">${estado.fase === 'estudio' ? '☕ Descanso ya' : '📖 Volver a estudiar'}</button>
        <button class="boton grande primario" data-acc="fin">■ Terminar sesión</button>
      </div>`;
  }

  capa.addEventListener('click', (e) => {
    const acc = e.target.closest('[data-acc]')?.dataset.acc;
    if (acc === 'pausa') {
      if (estado.enMarcha) { cerrarTramo(); estado.restantePausa = restante(); estado.enMarcha = false; }
      else { estado.finEn = Date.now() + estado.restantePausa * 1000; estado.enMarcha = true; estado.inicioTramo = Date.now(); }
      pintar();
    } else if (acc === 'fase') {
      cambiarFase(estado.fase === 'estudio' ? 'descanso' : 'estudio', true);
    } else if (acc === 'fin') {
      cerrarTramo();
      clearInterval(reloj);
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
      capa.remove();
      alTerminar(Math.round(estado.estudiado / 60));
    }
  });

  // Cada medio segundo: actualizar el reloj y cambiar de fase al llegar a 0.
  const reloj = setInterval(() => {
    if (estado.enMarcha && restante() <= 0) {
      avisoSonoro();
      // Tras estudiar → descanso automático. Tras descansar → espera a que pulses "Seguir".
      cambiarFase(estado.fase === 'estudio' ? 'descanso' : 'estudio', estado.fase === 'estudio');
    } else {
      const r = capa.querySelector('.temp-reloj');
      if (r) r.textContent = mmss(restante());
    }
  }, 500);

  pintar();
}
