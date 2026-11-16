// =====================================================================
// app.js — Arranque de la app y navegación entre pantallas.
// Las pantallas se eligen con la parte de la dirección después de "#":
//   #/hoy  #/semana  #/calendario  #/progreso  #/ajustes
// =====================================================================
import { cargarTodo } from './db.js';
import { inicializarSiHaceFalta, aplicarTema, ajustes, cambiarAjustes } from './ajustes.js';
import { recolocarAtrasadas } from './guia.js';
import { cargarFrases } from './frases.js';
import { hoyISO } from './fechas.js';
import * as hoy from './pantallas/hoy.js';
import { hayQueMostrarBienvenida, mostrarBienvenida } from './bienvenida.js';
import * as semana from './pantallas/semana.js';
import * as calendario from './pantallas/calendario.js';
import * as progreso from './pantallas/progreso.js';
import * as pantallaAjustes from './pantallas/ajustes.js';

// Cambia este número cada vez que publiques una versión nueva (y también en sw.js).
window.VERSION_APP = '1.2.0';

const PANTALLAS = { hoy, semana, calendario, progreso, ajustes: pantallaAjustes };

/** Objeto compartido con las pantallas. */
const app = {
  avisosHoy: [],   // mensajes de tareas recolocadas, para mostrarlos en HOY
  refrescar,
};

function pantallaActual() {
  const nombre = (location.hash.replace('#/', '') || 'hoy').split('?')[0];
  return PANTALLAS[nombre] ? nombre : 'hoy';
}

/** Vuelve a dibujar la pantalla actual. */
async function refrescar() {
  const nombre = pantallaActual();
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('activo', a.dataset.pantalla === nombre));
  await PANTALLAS[nombre].render(document.getElementById('pantalla'), app);
}

/** Una vez al día: recolocar tareas atrasadas. */
async function revisionDiaria() {
  if (ajustes().ultimaRevision === hoyISO()) return;
  app.avisosHoy = await recolocarAtrasadas();
  await cambiarAjustes({ ultimaRevision: hoyISO() });
}

async function arrancar() {
  await cargarTodo();
  await inicializarSiHaceFalta();
  aplicarTema();
  await cargarFrases();
  await revisionDiaria();
  if (hayQueMostrarBienvenida()) await mostrarBienvenida();
  await refrescar();
  hoy.reanudarTemporizador(app); // si se cerró la app con el temporizador en marcha

  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); refrescar(); });
  // Enlaces internos con data-ir="semana" etc.
  document.body.addEventListener('click', (e) => {
    const ir = e.target.closest('[data-ir]');
    if (ir) location.hash = `#/${ir.dataset.ir}`;
  });
  // Si la app se queda abierta y cambia el día (o vuelves a ella), se actualiza.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const antes = ajustes().ultimaRevision;
    await revisionDiaria();
    if (antes !== hoyISO() && !document.querySelector('dialog[open], .temporizador')) refrescar();
  });
}

// ---- Service worker: permite usar la app sin conexión y avisa de versiones nuevas ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const avisarActualizacion = () => {
      const barra = document.getElementById('actualizacion');
      barra.hidden = false;
      barra.querySelector('button').onclick = () => reg.waiting?.postMessage('actualizar');
    };
    if (reg.waiting) avisarActualizacion();
    reg.addEventListener('updatefound', () => {
      reg.installing?.addEventListener('statechange', (e) => {
        if (e.target.state === 'installed' && navigator.serviceWorker.controller) avisarActualizacion();
      });
    });
    reg.update().catch(() => {});
  });
  // Recargar solo cuando se ha pulsado "Actualizar" (no la primera vez que se instala).
  const habiaVersionAnterior = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habiaVersionAnterior && !recargando) { recargando = true; location.reload(); }
  });
}

arrancar().catch((err) => {
  console.error(err);
  document.getElementById('pantalla').innerHTML =
    `<div class="aviso peligro"><p>Error al arrancar: ${err.message}</p></div>`;
});
