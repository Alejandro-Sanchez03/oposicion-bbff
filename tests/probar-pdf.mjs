// =====================================================================
// Prueba del lector de PDF con una guía real de la academia.
// Uso:  node tests/probar-pdf.mjs ruta/a/la-guia.pdf
// (Necesita la versión de pdf.js para Node: npm install pdfjs-dist@4.10.38)
// =====================================================================
import fs from 'fs';
import { analizarGuia } from '../js/lector-pdf.js';

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])), verbosity: 0 }).promise;
const items = [];
for (let p = 1; p <= doc.numPages; p++) {
  for (const it of (await (await doc.getPage(p)).getTextContent()).items) {
    if (it.str.trim()) items.push({ p, x: it.transform[4], y: it.transform[5], w: it.width, s: it.str });
  }
}
const r = analizarGuia(items, process.argv[3] || undefined);
console.log(JSON.stringify(r, null, 2));
