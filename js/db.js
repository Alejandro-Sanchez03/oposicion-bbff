// =====================================================================
// db.js — Guardado de datos en el propio dispositivo (IndexedDB).
//
// Para que el resto del código sea sencillo, al arrancar se cargan TODOS
// los datos en memoria (objeto `datos`). Cada vez que algo cambia se llama
// a guardar()/borrar(), que actualiza la memoria y la base de datos a la vez.
// (Los datos de una oposición son pocos: esto va sobrado.)
// =====================================================================

const NOMBRE_BD = 'oposicion-bbff';
const VERSION_BD = 1;

// Cada "almacén" es como una tabla. `clave` es el campo que identifica cada registro.
export const ALMACENES = {
  ajustes:   { clave: 'id' },      // un único registro con id 'principal'
  dias:      { clave: 'fecha' },   // días de turno/libre corregidos a mano
  semanas:   { clave: 'id' },      // guías semanales importadas
  tareas:    { clave: 'uid' },     // tareas de las guías
  sesiones:  { clave: 'id' },      // tiempo de estudio registrado
  comodines: { clave: 'fecha' },   // días salvados con comodín
  tests:     { clave: 'id' },      // notas de tests
  temas:     { clave: 'id' },      // temario
};

/** Datos en memoria: datos.tareas es un array con todas las tareas, etc. */
export const datos = {};

let bd = null;

function abrirBD() {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(NOMBRE_BD, VERSION_BD);
    peticion.onupgradeneeded = () => {
      const base = peticion.result;
      for (const [nombre, cfg] of Object.entries(ALMACENES)) {
        if (!base.objectStoreNames.contains(nombre)) {
          base.createObjectStore(nombre, { keyPath: cfg.clave });
        }
      }
    };
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

function leerTodo(nombre) {
  return new Promise((resolver, rechazar) => {
    const p = bd.transaction(nombre).objectStore(nombre).getAll();
    p.onsuccess = () => resolver(p.result);
    p.onerror = () => rechazar(p.error);
  });
}

/** Ejecuta una operación de escritura y espera a que termine. */
function escribir(nombre, operacion) {
  return new Promise((resolver, rechazar) => {
    const tx = bd.transaction(nombre, 'readwrite');
    operacion(tx.objectStore(nombre));
    tx.oncomplete = () => resolver();
    tx.onerror = () => rechazar(tx.error);
  });
}

/** Carga todo en memoria. Se llama una vez al arrancar la app. */
export async function cargarTodo() {
  bd = await abrirBD();
  for (const nombre of Object.keys(ALMACENES)) {
    datos[nombre] = await leerTodo(nombre);
  }
  // Pide al navegador que no borre los datos aunque falte espacio.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
}

/** Guarda (crea o actualiza) uno o varios registros. */
export async function guardar(nombre, registros) {
  const lista = Array.isArray(registros) ? registros : [registros];
  const clave = ALMACENES[nombre].clave;
  for (const r of lista) {
    const i = datos[nombre].findIndex((x) => x[clave] === r[clave]);
    if (i >= 0) datos[nombre][i] = r; else datos[nombre].push(r);
  }
  await escribir(nombre, (almacen) => lista.forEach((r) => almacen.put(r)));
}

/** Borra uno o varios registros por su clave. */
export async function borrar(nombre, claves) {
  const lista = Array.isArray(claves) ? claves : [claves];
  const clave = ALMACENES[nombre].clave;
  datos[nombre] = datos[nombre].filter((x) => !lista.includes(x[clave]));
  await escribir(nombre, (almacen) => lista.forEach((k) => almacen.delete(k)));
}

/** Genera un identificador único sencillo. */
export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Copia de seguridad: devuelve un objeto con todos los datos. */
export function exportarTodo() {
  return {
    app: 'oposicion-bbff',
    version: 1,
    exportado: new Date().toISOString(),
    datos: JSON.parse(JSON.stringify(datos)),
  };
}

/** Restaura una copia de seguridad (sustituye TODOS los datos actuales). */
export async function importarTodo(copia) {
  if (!copia || copia.app !== 'oposicion-bbff' || !copia.datos) {
    throw new Error('El archivo no parece una copia de seguridad de esta app.');
  }
  for (const nombre of Object.keys(ALMACENES)) {
    const registros = Array.isArray(copia.datos[nombre]) ? copia.datos[nombre] : [];
    await escribir(nombre, (almacen) => {
      almacen.clear();
      registros.forEach((r) => almacen.put(r));
    });
    datos[nombre] = registros;
  }
}

/** Borra absolutamente todo. */
export async function borrarTodo() {
  for (const nombre of Object.keys(ALMACENES)) {
    await escribir(nombre, (almacen) => almacen.clear());
    datos[nombre] = [];
  }
}
