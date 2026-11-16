// =====================================================================
// frases.js — Frase motivadora del día.
// Las frases están en /frases.json (edítalo para añadir o quitar).
// Salen sin repetirse hasta que se han mostrado todas.
// =====================================================================
import { ajustes, cambiarAjustes } from './ajustes.js';
import { hoyISO } from './fechas.js';

let frases = [];

export async function cargarFrases() {
  try {
    const r = await fetch('frases.json');
    frases = (await r.json()).frases || [];
  } catch {
    frases = ['La constancia vence lo que la dicha no alcanza.'];
  }
}

/** Devuelve la frase de hoy (la misma durante todo el día). */
export async function fraseDeHoy() {
  if (!frases.length) return '';
  const a = ajustes();
  const hoy = hoyISO();
  if (a.fraseHoy && a.fraseHoy.fecha === hoy && frases[a.fraseHoy.indice]) return frases[a.fraseHoy.indice];
  let usadas = (a.frasesUsadas || []).filter((i) => i < frases.length);
  let libres = frases.map((_, i) => i).filter((i) => !usadas.includes(i));
  if (!libres.length) { usadas = []; libres = frases.map((_, i) => i); } // ya salieron todas: se reinicia
  const indice = libres[Math.floor(Math.random() * libres.length)];
  await cambiarAjustes({ frasesUsadas: [...usadas, indice], fraseHoy: { fecha: hoy, indice } });
  return frases[indice];
}

/** Frase sobre la racha (se usa a veces, solo si llevas racha). */
export function fraseRacha(dias) {
  if (dias < 2) return '';
  const opciones = [
    `Llevas ${dias} días seguidos. No la rompas hoy.`,
    `${dias} días seguidos cumpliendo. Hoy, uno más.`,
    `Racha de ${dias} días. Lo difícil ya lo has hecho: mantenerla.`,
  ];
  return opciones[dias % opciones.length];
}
