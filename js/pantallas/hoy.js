// =====================================================================
// Pantalla HOY — la principal. Solo lo que toca hoy.
// =====================================================================
import { datos, guardar } from '../db.js';
import { ajustes, cambiarAjustes } from '../ajustes.js';
import { hoyISO, textoLargo, textoCorto } from '../fechas.js';
import { tipoDia, capacidadDia } from '../turnos.js';
import { tareasDelDia, semanaDe, NOMBRE_TIPO, moverTarea } from '../guia.js';
import { ordenarTareasDelDia } from '../reparto.js';
import {
  minutosDelDia, tareasHechasDelDia, cumplido, rachaActual,
  diaParaComodin, usarComodin, registrarSesion, comodinDisponible,
} from '../racha.js';
import { fraseDeHoy, fraseRacha } from '../frases.js';
import { abrirTemporizador } from '../temporizador.js';
import { esc, dialogo, pedirTexto, toast, confirmar } from '../ui.js';

export async function render(cont, app) {
  const hoy = hoyISO();
  const a = ajustes();
  const tipo = tipoDia(hoy);
  const racha = rachaActual();
  const tareas = ordenarTareasDelDia(tareasDelDia(hoy));
  const semana = semanaDe(hoy);
  const frase = await fraseDeHoy();
  // La racha se menciona en días alternos (si llevas al menos 2 días).
  const textoRacha = racha >= 2 && new Date().getDate() % 2 === 0 ? fraseRacha(racha) : '';
  const minHoy = minutosDelDia(hoy);
  const hechasHoy = tareasHechasDelDia(hoy);
  const ok = cumplido(hoy);
  const diaComodin = diaParaComodin();
  const noCabe = semana && semana.avisos?.some((x) => x.startsWith('No cabe') || x.startsWith('Ni siquiera'));
  const pendientes = tareas.filter((t) => t.estado !== 'hecha' && t.tipo !== 'clase');

  const etiquetaDia = tipo === 'turno' ? 'DÍA DE TURNO' : tipo === 'libre' ? 'DÍA LIBRE' : 'DÍA SIN DEFINIR';

  cont.innerHTML = `
    <header class="hoy-cabecera">
      <div>
        <div class="hoy-fecha">${textoLargo(hoy)}</div>
        <div class="etiqueta-dia ${tipo || 'nada'}">${etiquetaDia}
          <small>${tipo ? `· hasta ${capacidadDia(hoy)} min` : '· márcalo en Calendario'}</small></div>
      </div>
      <div class="racha" title="Días seguidos cumpliendo el mínimo">🔥<b>${racha}</b><small>días</small></div>
    </header>

    ${frase ? `<blockquote class="frase">«${esc(frase)}»${textoRacha ? `<span>${esc(textoRacha)}</span>` : ''}</blockquote>` : ''}

    <button class="proximo" data-acc="proximo">
      <span class="proximo-titulo">➜ LO PRÓXIMO</span>
      <span class="proximo-texto">${a.proximo ? esc(a.proximo) : '<i>Aún nada. Se rellena al terminar una sesión.</i>'}</span>
    </button>

    ${app.avisosHoy.length ? `<div class="aviso info">
      ${app.avisosHoy.map((m) => `<p>🔁 ${esc(m)}</p>`).join('')}
      <button class="boton pequeno" data-acc="cerrar-avisos">Entendido</button></div>` : ''}

    ${diaComodin ? `<div class="aviso">
      <p>El ${textoCorto(diaComodin)} no llegaste al mínimo. ¿Usas el comodín de esa semana para no romper la racha?</p>
      <button class="boton pequeno primario" data-acc="comodin" data-fecha="${diaComodin}">🃏 Usar comodín</button></div>` : ''}

    ${noCabe ? `<div class="aviso peligro"><p>⚠ Esta semana no cabe todo.</p>
      <button class="boton pequeno" data-ir="semana">Ver la semana y el plan de mínimos</button></div>` : ''}

    <section class="lista-tareas">
      ${!datos.semanas.length ? `<div class="vacio"><p>Aún no has cargado ninguna guía semanal.</p>
          <button class="boton primario" data-ir="semana">Cargar la guía</button></div>`
        : !tareas.length ? `<div class="vacio"><p>${semana ? 'Hoy no tienes tareas asignadas. 💤' : 'No hay guía cargada para esta semana.'}</p>
          ${semana ? '' : '<button class="boton primario" data-ir="semana">Cargar la guía</button>'}</div>`
        : tareas.map((t, i) => tarjetaTarea(t, i)).join('')}
    </section>

    ${tareas.length && !pendientes.length && semana ? `<button class="boton ancho" data-acc="adelantar">⏩ Adelantar una tarea de los próximos días</button>` : ''}

    <section class="minimo ${ok ? 'cumplido' : ''}">
      <div class="minimo-texto">${ok ? '✓ Mínimo cumplido: hoy cuenta para la racha'
        : `Mínimo de hoy: ${a.minimoMinutos} min o ${a.minimoTareas} tarea(s)`}</div>
      <div class="barra"><div style="width:${Math.min(100, Math.max(minHoy / a.minimoMinutos, hechasHoy / a.minimoTareas) * 100)}%"></div></div>
      <div class="minimo-datos">${minHoy} min estudiados · ${hechasHoy} tarea(s) hechas ·
        comodín de la semana: ${comodinDisponible(hoy) ? 'disponible' : 'usado'}</div>
      <div class="fila-botones">
        <button class="boton" data-acc="libre">▶ Estudio libre</button>
        <button class="boton" data-acc="manual">+ Apuntar minutos</button>
      </div>
    </section>`;

  // ---- Acciones ----
  cont.onclick = async (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const acc = b.dataset.acc;
    const tarea = datos.tareas.find((t) => t.uid === b.dataset.uid);

    if (acc === 'empezar') abrirTemporizador(tarea, (min) => cerrarSesion(min, tarea, app));
    if (acc === 'libre') abrirTemporizador(null, (min) => cerrarSesion(min, null, app));
    if (acc === 'hecha') {
      const hecha = tarea.estado !== 'hecha';
      await guardar('tareas', { ...tarea, estado: hecha ? 'hecha' : 'pendiente', hechaEn: hecha ? hoy : null });
      if (hecha) toast('¡Hecha! 💪');
      app.refrescar();
    }
    if (acc === 'proximo') {
      const txt = await pedirTexto('¿Por dónde vas? / ¿Qué toca la próxima vez?', { valor: a.proximo });
      if (txt !== null) { await cambiarAjustes({ proximo: txt, proximoFecha: hoy }); app.refrescar(); }
    }
    if (acc === 'cerrar-avisos') { app.avisosHoy = []; app.refrescar(); }
    if (acc === 'comodin') { await usarComodin(b.dataset.fecha); toast('Comodín usado. La racha sigue viva.'); app.refrescar(); }
    if (acc === 'manual') {
      const min = await pedirTexto('¿Cuántos minutos has estudiado sin temporizador?', { tipo: 'number', placeholder: '20' });
      if (min && Number(min) > 0) {
        await registrarSesion({ minutos: Number(min) });
        await pedirProximo(app);
      }
    }
    if (acc === 'adelantar') await adelantar(app);
  };
}

function tarjetaTarea(t, i) {
  const hecha = t.estado === 'hecha';
  if (t.tipo === 'clase') {
    return `<article class="tarea clase"><div class="tarea-titulo">🎓 ${esc(t.titulo)}</div>
      <div class="tarea-datos">Clase · 17:00–20:00</div></article>`;
  }
  return `<article class="tarea ${hecha ? 'hecha' : ''}">
    <div class="tarea-num">${i + 1}</div>
    <div class="tarea-cuerpo">
      <div class="tarea-titulo">${esc(t.titulo)}</div>
      <div class="tarea-datos">${esc(t.tema)}${NOMBRE_TIPO[t.tipo] !== t.tema ? ` · ${NOMBRE_TIPO[t.tipo]}` : ''} · ${t.minutos} min
        ${t.minutosDedicados ? ` · llevas ${t.minutosDedicados} min` : ''}
        ${t.minimo ? ' · <span class="chip">mínimos</span>' : ''}
        ${!t.obligatoria ? ' · <span class="chip">opcional</span>' : ''}
        ${t.recolocadaDesde ? ` · <span class="chip">viene del ${textoCorto(t.recolocadaDesde)}</span>` : ''}</div>
      <div class="fila-botones">
        ${hecha ? '' : `<button class="boton grande primario" data-acc="empezar" data-uid="${t.uid}">▶ EMPEZAR</button>`}
        <button class="boton grande ${hecha ? '' : 'secundario'}" data-acc="hecha" data-uid="${t.uid}">${hecha ? '↩ Desmarcar' : '✓ Hecha'}</button>
      </div>
    </div></article>`;
}

/** Al terminar el temporizador: guarda el tiempo y pregunta por dónde vas. */
async function cerrarSesion(minutos, tarea, app) {
  await registrarSesion({ minutos, tareaUid: tarea?.uid });
  const res = await dialogo(`
      <h3>Sesión terminada: ${minutos} min</h3>
      ${tarea ? `<label class="check"><input type="checkbox" name="hecha"> He terminado «${esc(tarea.titulo)}»</label>` : ''}
      <label class="campo"><span>¿Por dónde vas? / ¿Qué toca la próxima vez?</span>
        <input name="proximo" placeholder="Ej: Seguir por el art. 19 del Reglamento" value="${esc(ajustes().proximo)}"></label>`,
    [{ texto: 'Guardar', valor: true, clase: 'primario' }],
    (form) => ({ hecha: form.hecha?.checked, proximo: form.proximo.value.trim() }));
  if (res && tarea && res.hecha) {
    const t = datos.tareas.find((x) => x.uid === tarea.uid);
    await guardar('tareas', { ...t, estado: 'hecha', hechaEn: hoyISO() });
  }
  if (res && res.proximo) await cambiarAjustes({ proximo: res.proximo, proximoFecha: hoyISO() });
  app.refrescar();
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
  const siguiente = ordenarTareasDelDia(datos.tareas.filter((t) => t.semanaId === semana.id &&
    t.estado !== 'hecha' && t.tipo !== 'clase' && t.dia_asignado && t.dia_asignado > hoy))
    .sort((x, y) => x.dia_asignado.localeCompare(y.dia_asignado))[0];
  if (!siguiente) { toast('No quedan tareas pendientes esta semana. 🎉'); return; }
  if (await confirmar(`¿Traer a hoy «${esc(siguiente.titulo)}» (${siguiente.minutos} min, estaba el ${textoCorto(siguiente.dia_asignado)})?`, 'Traer a hoy')) {
    await moverTarea(siguiente.uid, hoy);
    app.refrescar();
  }
}

