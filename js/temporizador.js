// =====================================================================
// temporizador.js — Temporizador tipo pomodoro a pantalla completa.
// Estudio (25 min) → descanso (5 min) → estudio... (configurable en Ajustes).
//
// - Usa la hora real del reloj: aunque la pantalla se apague, cuenta bien.
// - Se guarda en el dispositivo: si la app se cierra o se recarga, al
//   volver a abrirla el temporizador sigue donde estaba.
// =====================================================================
import { ajustes } from './ajustes.js';
import { esc } from './ui.js';

const CLAVE = 'temporizador-en-curso';
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

/** ¿Había un temporizador en marcha al cerrar la app? Devuelve su estado o null. */
export function temporizadorGuardado() {
  try {
    const e = JSON.parse(localStorage.getItem(CLAVE));
    // Si tiene más de 12 horas, se descarta.
    return e && Date.now() - e.creado < 12 * 3600 * 1000 ? e : null;
  } catch { return null; }
}

/**
 * Abre el temporizador.
 * @param {object|null} tarea  Tarea en la que vas a trabajar (o null = estudio libre).
 * @param {function} alTerminar  Recibe los minutos estudiados al pulsar "Terminar".
 * @param {object} [op]  { minutos: duración del bloque de estudio, titulo, estado: estado guardado }
 */
export function abrirTemporizador(tarea, alTerminar, op = {}) {
  const a = ajustes();
  const estado = op.estado || {
    tareaUid: tarea?.uid || null,
    titulo: op.titulo || (tarea ? tarea.titulo : 'Estudio libre'),
    dur: { estudio: (op.minutos || a.pomodoroEstudio) * 60, descanso: a.pomodoroDescanso * 60 },
    fase: 'estudio',          // 'estudio' o 'descanso'
    enMarcha: true,
    finEn: Date.now() + (op.minutos || a.pomodoroEstudio) * 60 * 1000, // momento en que acaba la fase
    restantePausa: null,      // segundos que quedaban al pausar
    estudiado: 0,             // segundos de estudio ya acumulados
    inicioTramo: Date.now(),  // desde cuándo se está contando estudio
    bloques: 0,
    creado: Date.now(),
  };
  const DUR = estado.dur;
  const guardarEstado = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin espacio */ } };

  const capa = document.createElement('div');
  document.body.appendChild(capa);
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wakeLock = w; }).catch(() => {});

  const restante = () => (estado.enMarcha ? Math.max(0, (estado.finEn - Date.now()) / 1000) : estado.restantePausa);

  /** Suma al contador el tramo de estudio en curso. */
  function cerrarTramo() {
    // (Nunca se cuenta más allá del final del bloque, por si la app estuvo cerrada.)
    if (estado.fase === 'estudio' && estado.enMarcha) estado.estudiado += Math.max(0, Math.min(Date.now(), estado.finEn) - estado.inicioTramo) / 1000;
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
    guardarEstado();
    pintar();
  }

  const R = 120;
  const CIRC = 2 * Math.PI * R;

  function pintar() {
    capa.className = `temporizador fase-${estado.fase} ${estado.enMarcha ? '' : 'en-pausa'}`;
    capa.innerHTML = `
      <div class="temp-brillo"></div>
      <div class="temp-tarea">${esc(estado.titulo)}</div>
      <div class="temp-fase">${estado.fase === 'estudio' ? 'Estudio' : 'Descanso'}${estado.enMarcha ? '' : ' · en pausa'}</div>
      <div class="temp-anillo">
        <svg viewBox="0 0 280 280" aria-hidden="true">
          <circle cx="140" cy="140" r="${R}" class="anillo-fondo"/>
          <circle cx="140" cy="140" r="${R}" class="anillo-progreso" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
        </svg>
        <div class="temp-reloj" aria-live="polite">${mmss(restante())}</div>
      </div>
      <div class="temp-info"></div>
      <div class="temp-botones">
        <button class="boton-redondo" data-acc="pausa" aria-label="${estado.enMarcha ? 'Pausa' : 'Seguir'}">
          ${estado.enMarcha ? '❚❚' : '▶'}<small>${estado.enMarcha ? 'Pausa' : 'Seguir'}</small></button>
        <button class="boton-redondo" data-acc="fase">
          ${estado.fase === 'estudio' ? '☕' : '📖'}<small>${estado.fase === 'estudio' ? 'Descanso' : 'Estudiar'}</small></button>
        <button class="boton-redondo principal" data-acc="fin">■<small>Terminar</small></button>
      </div>`;
    actualizar();
  }

  /** Actualiza solo lo que cambia cada segundo (reloj, anillo, minutos). */
  function actualizar() {
    const r = restante();
    const reloj = capa.querySelector('.temp-reloj');
    if (!reloj) return;
    reloj.textContent = mmss(r);
    capa.querySelector('.anillo-progreso').setAttribute('stroke-dashoffset', String(CIRC * (1 - r / DUR[estado.fase])));
    const total = estado.estudiado + (estado.fase === 'estudio' && estado.enMarcha ? (Date.now() - estado.inicioTramo) / 1000 : 0);
    capa.querySelector('.temp-info').textContent = `${Math.floor(total / 60)} min estudiados · ${estado.bloques} bloque(s)`;
  }

  capa.addEventListener('click', (e) => {
    const acc = e.target.closest('[data-acc]')?.dataset.acc;
    if (acc === 'pausa') {
      if (estado.enMarcha) { cerrarTramo(); estado.restantePausa = restante(); estado.enMarcha = false; }
      else { estado.finEn = Date.now() + estado.restantePausa * 1000; estado.enMarcha = true; estado.inicioTramo = Date.now(); }
      guardarEstado();
      pintar();
    } else if (acc === 'fase') {
      cambiarFase(estado.fase === 'estudio' ? 'descanso' : 'estudio', true);
    } else if (acc === 'fin') {
      cerrarTramo();
      clearInterval(reloj);
      localStorage.removeItem(CLAVE);
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
      actualizar();
    }
  }, 500);

  guardarEstado();
  pintar();
}
