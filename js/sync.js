// =====================================================================
// sync.js — Sincronizar los datos entre dispositivos (tablet, móvil, PC)
// usando un "gist" privado de TU cuenta de GitHub. Gratis y sin servidor propio.
//
// Cómo funciona:
//  - Cada dispositivo guarda sus datos como siempre (funciona sin internet).
//  - Al abrir la app, al volver a ella y unos segundos después de cada cambio,
//    descarga la copia del gist, la COMBINA con la suya y sube el resultado.
//  - Combinar = para cada registro gana el cambio más reciente (campo `_t`);
//    lo borrado se recuerda con una "lápida" (almacén `borrados`).
//
// La clave (token) de GitHub se guarda solo en este dispositivo
// (localStorage), nunca dentro de los datos sincronizados.
// =====================================================================
import { datos, ALMACENES, guardar, borrar, importarTodo } from './db.js';
import { AJUSTES_LOCALES } from './ajustes.js';

const CLAVE_CONFIG = 'sincronizacion';
const ARCHIVO = 'oposicion-bbff.json';
const API = 'https://api.github.com';

// ---------- Configuración (solo en este dispositivo) ----------

export function configSync() {
  try { return JSON.parse(localStorage.getItem(CLAVE_CONFIG)) || null; } catch { return null; }
}
function guardarConfig(cfg) {
  if (cfg) localStorage.setItem(CLAVE_CONFIG, JSON.stringify(cfg));
  else localStorage.removeItem(CLAVE_CONFIG);
}
export function desconectar() { guardarConfig(null); }

async function api(ruta, token, opciones = {}) {
  const r = await fetch(API + ruta, {
    ...opciones,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
  if (r.status === 401) throw new Error('La clave de GitHub no es válida o ha caducado.');
  if (r.status === 403 || r.status === 404) {
    const txt = await r.text();
    if (/rate limit/i.test(txt)) throw new Error('GitHub está limitando las peticiones; prueba en un rato.');
    throw new Error('La clave no tiene permiso para «gist». Crea una nueva marcando la casilla «gist».');
  }
  if (!r.ok) throw new Error(`GitHub respondió con un error (${r.status}).`);
  return r.status === 204 ? null : r.json();
}

// ---------- Foto de los datos y combinación ----------

/** Copia de todos los datos sincronizables. */
function foto() {
  const d = {};
  for (const nombre of Object.keys(ALMACENES)) d[nombre] = JSON.parse(JSON.stringify(datos[nombre] || []));
  return { app: 'oposicion-bbff', version: 1, datos: d };
}

/**
 * Combina dos fotos. Para cada registro gana el de `_t` más alto.
 * Un registro borrado (lápida más reciente que el registro) desaparece.
 */
export function fusionar(local, remoto) {
  const res = {};
  // 1) Lápidas: la más reciente de cada una
  const lapidas = new Map();
  for (const l of [...(local.borrados || []), ...(remoto.borrados || [])]) {
    if (!lapidas.has(l.id) || lapidas.get(l.id).t < l.t) lapidas.set(l.id, l);
  }
  res.borrados = [...lapidas.values()];
  // 2) Registros
  for (const [nombre, { clave }] of Object.entries(ALMACENES)) {
    if (nombre === 'borrados') continue;
    const mapa = new Map();
    for (const r of [...(remoto[nombre] || []), ...(local[nombre] || [])]) {
      const k = r[clave];
      const prev = mapa.get(k);
      if (!prev || (r._t || 0) > (prev._t || 0)) mapa.set(k, r);
    }
    res[nombre] = [...mapa.values()].filter((r) => {
      const l = lapidas.get(`${nombre}:${r[clave]}`);
      return !l || (r._t || 0) > l.t;
    });
  }
  // 3) Los ajustes locales de este dispositivo no se pisan
  const ajLocal = (local.ajustes || []).find((a) => a.id === 'principal');
  res.ajustes = res.ajustes.map((a) => {
    if (a.id !== 'principal' || !ajLocal) return a;
    const copia = { ...a };
    for (const k of AJUSTES_LOCALES) if (k in ajLocal) copia[k] = ajLocal[k];
    return copia;
  });
  return res;
}

/** Aplica la combinación a la base de datos local. Devuelve cuántos registros cambiaron. */
async function aplicar(combinado) {
  let cambios = 0;
  for (const [nombre, { clave }] of Object.entries(ALMACENES)) {
    const ahora = new Map((datos[nombre] || []).map((r) => [r[clave], r]));
    const nuevos = combinado[nombre] || [];
    const poner = nuevos.filter((r) => {
      const a = ahora.get(r[clave]);
      return !a || JSON.stringify(a) !== JSON.stringify(r);
    });
    const claves = new Set(nuevos.map((r) => r[clave]));
    const quitar = [...ahora.keys()].filter((k) => !claves.has(k));
    if (poner.length) await guardar(nombre, poner, { marcar: false });
    if (quitar.length) await borrar(nombre, quitar, { marcar: false });
    if (nombre !== 'borrados') cambios += poner.length + quitar.length;
  }
  return cambios;
}

/** Quita lo que no hace falta comparar (ajustes locales) para saber si dos fotos son iguales. */
function huella(d) {
  const copia = JSON.parse(JSON.stringify(d));
  (copia.ajustes || []).forEach((a) => AJUSTES_LOCALES.forEach((k) => delete a[k]));
  for (const [nombre, { clave }] of Object.entries(ALMACENES)) {
    (copia[nombre] || []).sort((x, y) => String(x[clave]).localeCompare(String(y[clave])));
  }
  return JSON.stringify(copia);
}

// ---------- Leer y escribir el gist ----------

async function leerGist(cfg) {
  const g = await api(`/gists/${cfg.gistId}`, cfg.token);
  const f = g.files?.[ARCHIVO];
  if (!f) return null;
  let contenido = f.content;
  if (f.truncated) contenido = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
  return JSON.parse(contenido);
}

async function escribirGist(cfg, copia) {
  await api(`/gists/${cfg.gistId}`, cfg.token, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [ARCHIVO]: { content: JSON.stringify(copia) } } }),
  });
}

// ---------- Lo que usa la app ----------

/**
 * Conecta este dispositivo con la clave de GitHub.
 * Busca el gist de la app; si no existe, lo crea con los datos de este dispositivo.
 * Devuelve { creado: bool, hayDatosRemotos: bool }.
 */
export async function conectar(token) {
  token = token.trim();
  const usuario = await api('/user', token);
  const gists = await api('/gists?per_page=100', token);
  const existente = gists.find((g) => g.files && g.files[ARCHIVO]);
  if (existente) {
    guardarConfig({ token, gistId: existente.id, usuario: usuario.login, ultima: null });
    return { creado: false, hayDatosRemotos: true };
  }
  const nuevo = await api('/gists', token, {
    method: 'POST',
    body: JSON.stringify({
      description: 'Oposición BF — datos de la app (no borrar)',
      public: false,
      files: { [ARCHIVO]: { content: JSON.stringify(foto()) } },
    }),
  });
  guardarConfig({ token, gistId: nuevo.id, usuario: usuario.login, ultima: new Date().toISOString() });
  return { creado: true, hayDatosRemotos: false };
}

/** Sustituye los datos de este dispositivo por los de la nube (para un dispositivo nuevo). */
export async function usarDatosDeLaNube() {
  const cfg = configSync();
  const remoto = await leerGist(cfg);
  if (remoto) {
    // Se conservan los ajustes locales de este dispositivo (modo oscuro, etc.)
    const ajLocal = datos.ajustes.find((a) => a.id === 'principal');
    await importarTodo(remoto);
    if (ajLocal) {
      const aj = datos.ajustes.find((a) => a.id === 'principal');
      if (aj) {
        const copia = { ...aj };
        AJUSTES_LOCALES.forEach((k) => { if (k in ajLocal) copia[k] = ajLocal[k]; });
        await guardar('ajustes', copia, { marcar: false });
      }
    }
  }
  guardarConfig({ ...cfg, ultima: new Date().toISOString() });
}

let enCurso = null;
/**
 * Sincroniza ahora. Devuelve { cambiosLocales, subido } o null si no está configurado / sin conexión.
 * Si ya hay una sincronización en marcha, espera a esa.
 */
export function sincronizar() {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const cfg = configSync();
    if (!cfg || !navigator.onLine) return null;
    const remoto = await leerGist(cfg);
    const local = foto().datos;
    const combinado = remoto ? fusionar(local, remoto.datos || {}) : local;
    const cambiosLocales = await aplicar(combinado);
    let subido = false;
    if (!remoto || huella(combinado) !== huella(remoto.datos || {})) {
      await escribirGist(cfg, { app: 'oposicion-bbff', version: 1, actualizado: new Date().toISOString(), datos: combinado });
      subido = true;
    }
    guardarConfig({ ...configSync(), ultima: new Date().toISOString(), error: null });
    return { cambiosLocales, subido };
  })().catch((e) => {
    const cfg = configSync();
    if (cfg) guardarConfig({ ...cfg, error: e.message });
    throw e;
  }).finally(() => { enCurso = null; });
  return enCurso;
}
