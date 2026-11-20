// =====================================================================
// Pantalla HOY — la principal. Solo lo que toca hoy.
//
// Arriba, una "portada" que cambia de color según el día:
// naranja fuego = TURNO, verde monte = LIBRE. Dentro: la racha, el mínimo
// diario y un gran botón para empezar lo siguiente sin pensar.
// =====================================================================
import { datos, guardar, nuevoId } from '../db.js';
import { ajustes, cambiarAjustes } from '../ajustes.js';
import { hoyISO, textoCorto, sumarDias, deISO, diferenciaDias, DIAS, MESES } from '../fechas.js';
import { tipoDia, capacidadDia } from '../turnos.js';
import {
  tareasDelDia, semanaDe, NOMBRE_TIPO, ICONO_TIPO, TIPOS_CON_NOTA, moverTarea, hoyNoPuedo, marcarTareaHecha,
} from '../guia.js';
import { ordenarTareasDelDia } from '../reparto.js';
import {
  minutosDelDia, tareasHechasDelDia, cumplido, rachaActual,
  diaParaComodin, usarComodin, registrarSesion, comodinDisponible,
} from '../racha.js';
import { fraseDeHoy, fraseRacha } from '../frases.js';
import { abrirTemporizador, temporizadorGuardado } from '../temporizador.js';
import { dialogoNota } from '../notas.js';
import { exportar } from './ajustes.js';
import { esc, dialogo, pedirTexto, toast, confirmar, celebrar } from '../ui.js';
import { semanaParaResumen, resumenDe, pasarPendientes, cerrarResumen } from '../resumen.js';

/** Dibujo del monte (crestas y pinos) que va al fondo de la portada. */
const PAISAJE = `<svg class="hero-paisaje" viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 110V62l38-22 30 16 46-34 40 30 34-18 42 28 50-36 44 30 36-14 40 20v48z" fill="currentColor" opacity=".16"/>
  <path d="M0 110V84l46-16 40 14 52-24 48 22 46-12 58 20 52-18 58 14v26z" fill="currentColor" opacity=".24"/>
  <g fill="currentColor" opacity=".32">
    <path d="M30 110l9-26 9 26zM52 110l7-20 7 20zM300 110l9-28 9 28zM322 110l7-19 7 19zM344 110l6-15 6 15zM150 110l7-21 7 21z"/>
  </g></svg>`;

const ETIQUETA = {
  turno: { txt: 'Día de turno', icono: '🚒' },
  libre: { txt: 'Día libre', icono: '🌲' },
  nada: { txt: 'Día sin definir', icono: '❔' },
  pausa: { txt: 'Día de descanso', icono: '🏖️' },
};

export async function render(cont, app) {
  const hoy = hoyISO();
  const a = ajustes();
  const tipo = tipoDia(hoy) || 'nada';
  const racha = rachaActual();
  const tareas = ordenarTareasDelDia(tareasDelDia(hoy));
  const semana = semanaDe(hoy);
  const frase = await fraseDeHoy();
  const textoRacha = racha >= 2 && new Date().getDate() % 2 === 0 ? fraseRacha(racha) : '';
  const minHoy = minutosDelDia(hoy);
  const hechasHoy = tareasHechasDelDia(hoy);
  const ok = cumplido(hoy);
  const progreso = Math.min(1, Math.max(minHoy / a.minimoMinutos, hechasHoy / a.minimoTareas));
  const diaComodin = diaParaComodin();
  const noCabe = semana && semana.avisos?.some((x) => x.startsWith('No cabe') || x.startsWith('Ni siquiera'));
  const pendientes = tareas.filter((t) => t.estado !== 'hecha' && t.tipo !== 'clase');
  const siguiente = pendientes[0];
  const f = deISO(hoy);
  const diasExamen = a.fechaExamen ? diferenciaDias(hoy, a.fechaExamen) : null;
  const copiaVieja = (datos.tareas.length || datos.sesiones.length) &&
    diferenciaDias(a.ultimaCopia || a.fechaInicio || hoy, hoy) >= 7;

  // Anillo del mínimo diario
  const R = 40, CIRC = 2 * Math.PI * R;

  cont.innerHTML = `
    <section class="hero hero-${tipo}">
      ${PAISAJE}
      <div class="hero-arriba">
        <div>
          <div class="hero-dia">${DIAS[f.getDay()]}</div>
          <div class="hero-fecha">${f.getDate()} de ${MESES[f.getMonth()]}</div>
        </div>
        ${diasExamen != null && diasExamen >= 0 ? `<div class="hero-cuenta"><b>${diasExamen}</b><small>${diasExamen === 1 ? 'día' : 'días'} al examen</small></div>` : ''}
      </div>
      <div class="hero-etiqueta">${ETIQUETA[tipo].icono} ${ETIQUETA[tipo].txt}
        <span>${tipo === 'nada' ? 'márcalo en Calendario' : tipo === 'pausa' ? 'no cuenta para la racha' : `hasta ${capacidadDia(hoy)} min`}</span></div>

      <div class="hero-centro">
        <div class="anillo-racha ${ok ? 'cumplido' : ''}" title="Racha: días seguidos cumpliendo el mínimo">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="${R}" class="anillo-fondo"/>
            <circle cx="50" cy="50" r="${R}" class="anillo-progreso" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC * (1 - progreso)}"/>
          </svg>
          <div class="anillo-texto"><span class="llama ${racha ? 'viva' : ''}">🔥</span><b>${racha}</b><small>${racha === 1 ? 'día' : 'días'}</small></div>
        </div>
        <div class="hero-minimo">
          <b>${ok ? '¡Mínimo cumplido!' : 'Mínimo de hoy'}</b>
          <span>${ok ? 'Hoy ya cuenta para la racha.' : `${minHoy}/${a.minimoMinutos} min o ${hechasHoy}/${a.minimoTareas} tarea${a.minimoTareas > 1 ? 's' : ''}`}</span>
          <span class="hero-comodin">🃏 Comodín ${comodinDisponible(hoy) ? 'disponible' : 'usado'}</span>
        </div>
      </div>

      ${siguiente
        ? `<button class="cta" data-acc="empezar" data-uid="${siguiente.uid}">
            <span class="cta-play">▶</span>
            <span class="cta-texto"><b>EMPEZAR</b><small>${ICONO_TIPO[siguiente.tipo]} ${esc(siguiente.titulo)} · ${siguiente.minutos} min</small></span></button>`
        : tareas.length
          ? `<button class="cta hecho" data-acc="adelantar"><span class="cta-play">🎉</span>
              <span class="cta-texto"><b>Todo hecho por hoy</b><small>¿Adelantas algo de mañana?</small></span></button>`
          : `<button class="cta" data-acc="libre"><span class="cta-play">▶</span>
              <span class="cta-texto"><b>ESTUDIO LIBRE</b><small>Hoy no hay tareas asignadas</small></span></button>`}

      <div class="hero-acciones">
        <button data-acc="diez">⚡ Solo 10 min</button>
        ${pendientes.length ? '<button data-acc="no-puedo">🛌 Hoy no puedo</button>' : ''}
        <button data-acc="manual">✏️ Apuntar minutos</button>
      </div>
    </section>

    ${tarjetaResumen(semana)}
    ${tarjetaTestClase()}

    ${frase ? `<blockquote class="frase"><p>${esc(frase)}</p>${textoRacha ? `<span>${esc(textoRacha)}</span>` : ''}</blockquote>` : ''}

    <button class="nota-proximo" data-acc="proximo">
      <span class="nota-chincheta">📌</span>
      <span class="nota-titulo">Lo próximo</span>
      <span class="nota-texto">${a.proximo ? esc(a.proximo) : '<i>Al terminar una sesión, escribe aquí por dónde vas.</i>'}</span>
    </button>

    ${app.avisosHoy.length ? `<div class="aviso info">
      <p><b>🔁 He recolocado tareas:</b></p>${app.avisosHoy.map((m) => `<p>${esc(m)}</p>`).join('')}
      <button class="boton pequeno" data-acc="cerrar-avisos">Entendido</button></div>` : ''}

    ${diaComodin ? `<div class="aviso">
      <p>El <b>${textoCorto(diaComodin)}</b> no llegaste al mínimo. ¿Usas el comodín de esa semana para salvar la racha?</p>
      <button class="boton pequeno primario" data-acc="comodin" data-fecha="${diaComodin}">🃏 Usar comodín</button></div>` : ''}

    ${noCabe ? `<div class="aviso peligro"><p>⚠ Esta semana no cabe todo.</p>
      <button class="boton pequeno" data-ir="semana">Ver la semana y el plan de mínimos</button></div>` : ''}

    ${copiaVieja ? `<div class="aviso"><p>💾 Hace más de una semana que no guardas una copia de seguridad.</p>
      <button class="boton pequeno" data-acc="copia">Guardar copia ahora</button></div>` : ''}

    <h2 class="titulo-seccion">Tareas de hoy ${conteo(tareas)}</h2>
    <section class="lista-tareas">
      ${!datos.semanas.length ? `<div class="vacio"><div class="vacio-emoji">🗂️</div><p>Aún no has cargado ninguna guía semanal.</p>
          <button class="boton primario" data-ir="semana">Cargar la guía</button></div>`
        : !tareas.length ? `<div class="vacio"><div class="vacio-emoji">${semana ? '😌' : '🗂️'}</div>
          <p>${semana ? 'Hoy no tienes tareas. Si te apetece, «Solo 10 min» o adelanta algo.' : 'No hay guía cargada para esta semana.'}</p>
          ${semana ? '<button class="boton" data-acc="adelantar">⏩ Adelantar una tarea</button>' : '<button class="boton primario" data-ir="semana">Cargar la guía</button>'}</div>`
        : tareas.map((t) => tarjetaTarea(t, t === siguiente)).join('')}
    </section>

    ${vistaManana(hoy)}`;

  // ---- Acciones ----
  cont.onclick = async (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const acc = b.dataset.acc;
    const tarea = datos.tareas.find((t) => t.uid === b.dataset.uid);

    if (acc === 'empezar') abrirTemporizador(tarea, (min) => cerrarSesion(min, tarea, app));
    if (acc === 'libre') abrirTemporizador(null, (min) => cerrarSesion(min, null, app));
    if (acc === 'diez') {
      // La tarea ligera más corta pendiente de hoy (o estudio libre)
      const ligera = pendientes.filter((t) => t.tipo !== 'estudio').sort((x, y) => x.minutos - y.minutos)[0];
      abrirTemporizador(ligera || null, (min) => cerrarSesion(min, ligera || null, app),
        { minutos: 10, titulo: ligera ? `10 min · ${ligera.titulo}` : '10 minutos. Solo eso.' });
    }
    if (acc === 'hecha') await marcarHecha(tarea, b, app);
    if (acc === 'proximo') {
      const txt = await pedirTexto('¿Por dónde vas? / ¿Qué toca la próxima vez?', { valor: a.proximo });
      if (txt !== null) { await cambiarAjustes({ proximo: txt, proximoFecha: hoy }); app.refrescar(); }
    }
    if (acc === 'cerrar-avisos') { app.avisosHoy = []; app.refrescar(); }
    if (acc === 'comodin') { await usarComodin(b.dataset.fecha); celebrar(b); toast('Comodín usado. La racha sigue viva 🔥'); app.refrescar(); }
    if (acc === 'manual') {
      const min = await pedirTexto('¿Cuántos minutos has estudiado sin temporizador?', { tipo: 'number', placeholder: '20' });
      if (min && Number(min) > 0) {
        const antes = cumplido(hoy);
        await registrarSesion({ minutos: Number(min) });
        if (!antes && cumplido(hoy)) celebrar();
        await pedirProximo(app);
      }
    }
    if (acc === 'no-puedo') {
      if (!(await confirmar(`Paso tus ${pendientes.length} tarea(s) de hoy a los próximos días de la semana.<br><br>
        Sin culpa: a veces el turno no da para más. Si mañana ves que no llegaste al mínimo, tienes el comodín.`, 'Pasarlas', 'Mejor no'))) return;
      app.avisosHoy = await hoyNoPuedo();
      app.refrescar();
    }
    if (acc === 'adelantar') await adelantar(app);
    if (acc === 'copia') { await exportar(); app.refrescar(); }
    if (acc === 'nota-clase' || acc === 'nota-clase-no') {
      if (acc === 'nota-clase') {
        const sem = datos.semanas.find((x) => x.id === tarea.semanaId);
        const n = /(\d+)\s*preguntas/i.exec(tarea.titulo);
        const guardado = await dialogoNota({ tema: sem?.prioridad?.[0] || '', fecha: tarea.dia_asignado, titulo: `✍️ ${tarea.titulo}`, tareaUid: tarea.uid, preguntas: n ? Number(n[1]) : null });
        if (!guardado) return;
      }
      await guardar('tareas', { ...datos.tareas.find((x) => x.uid === tarea.uid), notaPedida: true });
      app.refrescar();
    }
    if (acc === 'resumen-cerrar') { await cerrarResumen(semanaParaResumen()); app.refrescar(); }
    if (acc === 'resumen-pasar') {
      const n = await pasarPendientes(semanaParaResumen());
      toast(`${n} tarea(s) pasadas a esta semana`);
      app.refrescar();
    }
  };
}

/** Tarjeta con el resumen de la semana que acaba de terminar. */
function tarjetaResumen(semanaActual) {
  const s = semanaParaResumen();
  if (!s) return '';
  const r = resumenDe(s);
  const horas = (r.minutos / 60).toFixed(1).replace('.', ',');
  const pct = r.total ? Math.round((r.hechas / r.total) * 100) : 0;
  const titular = pct >= 90 ? '¡Semanón! 🔥' : pct >= 60 ? 'Buena semana 💪' : r.hechas ? 'Semana superada' : 'Semana nueva, página nueva';
  return `<section class="resumen-semana">
    <div class="resumen-cab"><span>Semana del ${s.texto.replace(' a ', ' al ').replace(/\d{4}-(\d{2})-(\d{2})/g, '$2/$1')}</span><b>${titular}</b></div>
    <div class="resumen-cifras">
      <div><b>${r.hechas}/${r.total}</b><small>tareas</small></div>
      <div><b>${horas} h</b><small>estudiadas</small></div>
      ${r.contables ? `<div><b>${r.cumplidos}/${r.contables}</b><small>días cumplidos</small></div>` : ''}
      ${r.media != null ? `<div><b>${r.media.toFixed(1).replace('.', ',')}</b><small>nota media</small></div>` : ''}
    </div>
    ${r.pendientes.length ? `<p class="resumen-pend">Quedaron ${r.pendientes.length} sin hacer${r.obligatoriasPendientes.length ? ` (${r.obligatoriasPendientes.length} obligatoria${r.obligatoriasPendientes.length > 1 ? 's' : ''})` : ''}:
      ${r.pendientes.slice(0, 4).map((t) => esc(t.titulo)).join(' · ')}${r.pendientes.length > 4 ? '…' : ''}</p>` : '<p class="resumen-pend">No quedó nada pendiente. 👏</p>'}
    <div class="fila-botones">
      ${r.pendientes.length && semanaActual ? `<button class="boton pequeno primario" data-acc="resumen-pasar">↪ Pasarlas a esta semana</button>` : ''}
      <button class="boton pequeno" data-acc="resumen-cerrar">${r.pendientes.length ? 'Dejarlas' : 'Cerrar'}</button>
    </div>
    ${r.pendientes.length && !semanaActual ? '<p class="ayuda">Carga la guía de esta semana para poder pasarlas.</p>' : ''}
  </section>`;
}

/** "2/3 hechas" (sin contar la clase). */
function conteo(tareas) {
  const t = tareas.filter((x) => x.tipo !== 'clase');
  return t.length ? `<small>${t.filter((x) => x.estado === 'hecha').length}/${t.length} hechas</small>` : '';
}

function tarjetaTarea(t, esSiguiente) {
  const hecha = t.estado === 'hecha';
  if (t.tipo === 'clase') {
    return `<article class="tarea tipo-clase"><div class="tarea-icono">${ICONO_TIPO.clase}</div>
      <div class="tarea-cuerpo"><div class="tarea-titulo">${esc(t.titulo)}</div>
      <div class="tarea-datos">Clase · 17:00–20:00</div></div></article>`;
  }
  return `<article class="tarea tipo-${t.tipo} ${hecha ? 'hecha' : ''} ${esSiguiente ? 'siguiente' : ''}">
    <div class="tarea-icono">${ICONO_TIPO[t.tipo]}</div>
    <div class="tarea-cuerpo">
      ${esSiguiente ? '<div class="tarea-sigue">Lo siguiente</div>' : ''}
      <div class="tarea-titulo">${esc(t.titulo)}</div>
      <div class="tarea-datos">
        <span>${esc(t.tema)}${NOMBRE_TIPO[t.tipo] !== t.tema ? ` · ${NOMBRE_TIPO[t.tipo]}` : ''}</span>
        <span>⏱ ${t.minutos} min${t.minutosDedicados ? ` (llevas ${t.minutosDedicados})` : ''}</span>
        ${t.minimo ? '<span class="chip">mínimos</span>' : ''}
        ${!t.obligatoria ? '<span class="chip">opcional</span>' : ''}
        ${t.recolocadaDesde ? `<span class="chip">viene del ${textoCorto(t.recolocadaDesde)}</span>` : ''}
        ${t.rescate ? `<span class="chip atrasado">📚 atrasado${t.origenSemana ? ` · semana del ${textoCorto(t.origenSemana)}` : ''}</span>` : ''}
      </div>
    </div>
    <div class="tarea-botones">
      ${hecha ? '' : `<button class="boton-play" data-acc="empezar" data-uid="${t.uid}" aria-label="Empezar">▶</button>`}
      <button class="boton-check" data-acc="hecha" data-uid="${t.uid}" aria-label="${hecha ? 'Desmarcar' : 'Marcar como hecha'}">✓</button>
    </div></article>`;
}

/** Vista previa de mañana, para saber lo que viene. */
function vistaManana(hoy) {
  const manana = sumarDias(hoy, 1);
  const tipo = tipoDia(manana);
  const t = tareasDelDia(manana).filter((x) => x.tipo !== 'clase');
  const min = t.reduce((s, x) => s + x.minutos, 0);
  return `<section class="manana">
    <div class="manana-cab"><b>Mañana</b>
      <span class="etiqueta-dia mini ${tipo || 'nada'}">${tipo ? tipo.toUpperCase() : 'SIN DEFINIR'}</span>
      <span>${t.length ? `${t.length} tarea(s) · ${min} min` : 'sin tareas'}</span></div>
    ${t.length ? `<div class="manana-lista">${t.map((x) => `<span>${ICONO_TIPO[x.tipo]} ${esc(x.titulo)}</span>`).join('')}</div>` : ''}
  </section>`;
}

/** Marca/desmarca una tarea. Con "Deshacer" y, si es un test, ofrece apuntar la nota. */
async function marcarHecha(tarea, boton, app) {
  const hoy = hoyISO();
  const hecha = tarea.estado !== 'hecha';
  const antes = cumplido(hoy);
  await marcarTareaHecha(tarea, hecha);
  if (!hecha) { app.refrescar(); return; }
  celebrar(boton);
  if (!antes && cumplido(hoy)) setTimeout(() => celebrar(), 350);
  if (TIPOS_CON_NOTA.includes(tarea.tipo)) await pedirNota(tarea);
  app.refrescar();
  toast('¡Hecha! 💪', {
    boton: 'Deshacer',
    alPulsar: async () => { await marcarTareaHecha(tarea, false); app.refrescar(); },
  });
}

/** Al terminar un test: apuntar la nota en el momento. */
async function pedirNota(tarea) {
  const n = /(\d+)\s*preguntas/i.exec(tarea.titulo);
  await dialogoNota({ tema: tarea.tema, titulo: `✍️ ¿Qué tal «${tarea.titulo}»?`, tareaUid: tarea.uid, preguntas: n ? Number(n[1]) : null });
}

/** El test de clase del jueves ya pasó y no has apuntado la nota. */
function testDeClasePendiente() {
  const hoy = hoyISO();
  const tarde = new Date().getHours() >= 20;
  return datos.tareas.find((t) => t.tipo === 'clase' && /test|examen/i.test(t.titulo) && !t.notaPedida && t.dia_asignado &&
    (t.dia_asignado < hoy || (t.dia_asignado === hoy && tarde)) && diferenciaDias(t.dia_asignado, hoy) <= 7) || null;
}

function tarjetaTestClase() {
  const t = testDeClasePendiente();
  if (!t) return '';
  return `<div class="aviso info"><p>✍️ <b>¿Qué tal el ${esc(t.titulo.toLowerCase())}</b> del ${textoCorto(t.dia_asignado)}?
    Apunta la nota: así verás qué temas flojean.</p>
    <div class="fila-botones"><button class="boton pequeno primario" data-acc="nota-clase" data-uid="${t.uid}">Apuntar nota</button>
    <button class="boton pequeno" data-acc="nota-clase-no" data-uid="${t.uid}">No lo hice</button></div></div>`;
}

/** Al terminar el temporizador: guarda el tiempo y pregunta por dónde vas. */
async function cerrarSesion(minutos, tarea, app) {
  const hoy = hoyISO();
  const antes = cumplido(hoy);
  await registrarSesion({ minutos, tareaUid: tarea?.uid });
  if (!antes && cumplido(hoy)) celebrar();
  const res = await dialogo(`
      <div class="sesion-fin"><b>${minutos}</b><span>min estudiados</span></div>
      ${tarea && tarea.estado !== 'hecha' ? `<label class="check"><input type="checkbox" name="hecha"> He terminado «${esc(tarea.titulo)}»</label>` : ''}
      <label class="campo"><span>¿Por dónde vas? / ¿Qué toca la próxima vez?</span>
        <input name="proximo" placeholder="Ej: Seguir por el art. 19 del Reglamento" value="${esc(ajustes().proximo)}"></label>`,
    [{ texto: 'Guardar', valor: true, clase: 'primario' }],
    (form) => ({ hecha: form.hecha?.checked, proximo: form.proximo.value.trim() }));
  if (res && res.proximo) await cambiarAjustes({ proximo: res.proximo, proximoFecha: hoy });
  if (res && tarea && res.hecha) {
    const t = datos.tareas.find((x) => x.uid === tarea.uid);
    await marcarTareaHecha(t, true);
    celebrar();
    if (TIPOS_CON_NOTA.includes(t.tipo)) await pedirNota(t);
  }
  app.refrescar();
}

/** Si la app se cerró con el temporizador en marcha, lo recupera. */
export function reanudarTemporizador(app) {
  const estado = temporizadorGuardado();
  if (!estado) return;
  const tarea = datos.tareas.find((t) => t.uid === estado.tareaUid) || null;
  abrirTemporizador(tarea, (min) => cerrarSesion(min, tarea, app), { estado });
}

async function pedirProximo(app) {
  const txt = await pedirTexto('¿Por dónde vas? / ¿Qué toca la próxima vez?', { valor: ajustes().proximo });
  if (txt) await cambiarAjustes({ proximo: txt, proximoFecha: hoyISO() });
  app.refrescar();
}

/** Trae a hoy la siguiente tarea pendiente de la semana. */
async function adelantar(app) {
  const hoy = hoyISO();
  const semana = semanaDe(hoy);
  if (!semana) return;
  const siguiente = datos.tareas.filter((t) => t.semanaId === semana.id &&
    t.estado !== 'hecha' && t.tipo !== 'clase' && t.dia_asignado && t.dia_asignado > hoy)
    .sort((x, y) => x.dia_asignado.localeCompare(y.dia_asignado) || x.orden - y.orden)[0];
  if (!siguiente) { toast('No quedan tareas pendientes esta semana 🎉'); return; }
  if (await confirmar(`¿Traer a hoy «${esc(siguiente.titulo)}» (${siguiente.minutos} min, estaba el ${textoCorto(siguiente.dia_asignado)})?`, 'Traer a hoy')) {
    await moverTarea(siguiente.uid, hoy);
    app.refrescar();
  }
}
