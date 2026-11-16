// =====================================================================
// Prueba del reparto: una semana con 4 días de TURNO y 3 LIBRES.
// Ejecutar con:  node tests/probar-reparto.mjs
// =====================================================================
import { repartir, calcularDependencias } from '../js/reparto.js';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const nombre = (f) => `${DIAS_SEMANA[new Date(f).getUTCDay()]} ${f.slice(8)}`;

// Semana de viernes 20 a jueves 26 de noviembre de 2026
const turnos = {
  '2026-11-20': 'libre', '2026-11-21': 'turno', '2026-11-22': 'turno', '2026-11-23': 'turno',
  '2026-11-24': 'turno', '2026-11-25': 'libre', '2026-11-26': 'libre',
};
const CAP = { turno: 45, libre: 210 };
const dias = Object.entries(turnos).map(([fecha, tipo]) => ({ fecha, tipo, capacidad: CAP[tipo] }));

const guia = [
  ['t1', 'Estudiar apartado 5 PEIF', 'PEIF', 'estudio', true, '2026-11-20', 120, false],
  ['t2', 'Test apartado 5 PEIF', 'PEIF', 'test', true, '2026-11-21', 30, true],
  ['t3', 'Estudiar Documento IV PEIF', 'PEIF', 'estudio', true, '2026-11-22', 90, true],
  ['t4', 'Autoevaluación Documento IV', 'PEIF', 'autoevaluacion', true, '2026-11-23', 20, true],
  ['t5', 'Estudiar arts. 1-20 Reglamento SBF', 'Reglamento', 'estudio', true, '2026-11-23', 120, false],
  ['t6', 'Test arts. 1-20 Reglamento', 'Reglamento', 'test', true, '2026-11-24', 30, false],
  ['t7', 'Repaso Anexo 2', 'PEIF', 'repaso', true, '2026-11-24', 25, true],
  ['t8', 'Aptitud numérica 02', 'Psicotécnico', 'psicotecnico', false, '2026-11-21', 45, false],
  ['t9', 'Razonamiento abstracto 03', 'Psicotécnico', 'psicotecnico', false, '2026-11-25', 40, false],
  ['t10', 'Fichas PE: espumógenos', 'Fichas PE', 'estudio', false, '2026-11-25', 60, false],
  ['t11', 'Clase semanal', 'Academia', 'clase', true, '2026-11-26', 0, false],
];
const tareas = guia.map(([id, titulo, tema, tipo, obligatoria, dia_sugerido, minutos, minimo], orden) => ({
  uid: id, id, titulo, tema, tipo, obligatoria, dia_sugerido, minutos, minimo, orden,
  estado: 'pendiente', fijada: tipo === 'clase', dia_asignado: tipo === 'clase' ? '2026-11-26' : null,
}));
const prioridad = ['PEIF', 'Reglamento', 'Psicotécnico', 'Fichas PE'];

function mostrar(titulo, r) {
  console.log(`\n=== ${titulo} ===`);
  for (const d of dias) {
    const deDia = tareas.filter((t) => r.asignacion[t.uid] === d.fecha);
    const usados = deDia.reduce((s, t) => s + t.minutos, 0);
    console.log(`\n${nombre(d.fecha)}  ${d.tipo.toUpperCase().padEnd(5)}  ${usados}/${d.capacidad} min`);
    deDia.forEach((t) => console.log(`   - ${t.titulo} (${t.tipo}, ${t.minutos} min${t.obligatoria ? '' : ', opcional'}${t.minimo ? ', mínimos' : ''}) [sugerido ${nombre(t.dia_sugerido)}]`));
  }
  const sin = tareas.filter((t) => r.asignacion[t.uid] == null);
  if (sin.length) console.log(`\nSIN HUECO: ${sin.map((t) => t.titulo).join(', ')}`);
  r.avisos.forEach((a) => console.log(`AVISO: ${a}`));
}

// Comprobaciones automáticas
function comprobar(r) {
  const errores = [];
  const deps = calcularDependencias(tareas);
  for (const t of tareas) {
    const dia = r.asignacion[t.uid];
    if (!dia) continue;
    for (const d of deps.get(t.uid)) {
      if (!r.asignacion[d] || r.asignacion[d] > dia) errores.push(`${t.titulo} va antes que su estudio`);
    }
  }
  for (const d of dias) {
    const usados = tareas.filter((t) => r.asignacion[t.uid] === d.fecha).reduce((s, t) => s + t.minutos, 0);
    if (usados > d.capacidad) errores.push(`${d.fecha} supera la capacidad`);
  }
  console.log(errores.length ? `\n❌ ERRORES:\n${errores.join('\n')}` : '\n✅ Orden lógico y capacidades correctos');
  return errores.length === 0;
}

const r1 = repartir({ tareas, dias, prioridad });
mostrar('Reparto normal (turno 45 min, libre 210 min)', r1);
const ok1 = comprobar(r1);

// Caso apretado: libres de solo 120 min → no cabe todo
const apretados = dias.map((d) => ({ ...d, capacidad: d.tipo === 'libre' ? 120 : 45 }));
const r2 = repartir({ tareas, dias: apretados, prioridad });
dias.splice(0, dias.length, ...apretados);
mostrar('Semana apretada (libres de solo 120 min)', r2);
const r3 = repartir({ tareas, dias, prioridad, modoMinimos: true });
mostrar('Misma semana con PLAN DE MÍNIMOS', r3);
const ok2 = comprobar(r3);
process.exit(ok1 && ok2 ? 0 : 1);
