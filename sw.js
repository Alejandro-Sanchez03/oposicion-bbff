// =====================================================================
// sw.js — "Service worker": guarda la app en el dispositivo para que
// funcione SIN INTERNET.
//
// ⚠ IMPORTANTE: cada vez que cambies cualquier archivo de la app, sube el
// número de VERSION (y window.VERSION_APP en js/app.js). Así los dispositivos
// detectan que hay versión nueva y muestran el botón "Actualizar".
// =====================================================================
const VERSION = '1.1.0';
const CACHE = `oposicion-bbff-${VERSION}`;

const ARCHIVOS = [
  './', 'index.html', 'manifest.json', 'frases.json', 'css/estilos.css',
  'js/app.js', 'js/db.js', 'js/ajustes.js', 'js/fechas.js', 'js/turnos.js', 'js/reparto.js',
  'js/guia.js', 'js/racha.js', 'js/bienvenida.js', 'js/frases.js', 'js/ui.js', 'js/temporizador.js',
  'js/pantallas/hoy.js', 'js/pantallas/semana.js', 'js/pantallas/calendario.js',
  'js/pantallas/progreso.js', 'js/pantallas/ajustes.js',
  'fuentes/bricolage.woff2', 'fuentes/inter.woff2',
  'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/icono-maskable-512.png',
];

// Al instalar: descargar y guardar todos los archivos.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS.map((a) => new Request(a, { cache: 'reload' })))));
});

// Al activar: borrar versiones antiguas.
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cuando pulsas "Actualizar" en la app.
self.addEventListener('message', (e) => {
  if (e.data === 'actualizar') self.skipWaiting();
});

// Peticiones: primero lo guardado; si no está, a internet.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)),
  );
});
