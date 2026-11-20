// =====================================================================
// ui.js — Pequeñas ayudas para la interfaz: ventanas de diálogo,
// avisos flotantes y escapar texto.
// =====================================================================

/** Evita que un texto escrito por ti se interprete como HTML. */
export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Muestra un aviso breve abajo de la pantalla.
 * Opcionalmente con un botón (p. ej. Deshacer): toast('Hecha', { boton: 'Deshacer', alPulsar: fn })
 */
export function toast(mensaje, { boton = null, alPulsar = null } = {}) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(mensaje)}</span>${boton ? `<button>${esc(boton)}</button>` : ''}`;
  if (boton) el.querySelector('button').onclick = () => { el.remove(); alPulsar(); };
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('visible'), 10);
  setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, boton ? 5000 : 2800);
}

/** Pequeña celebración: chispas que suben desde un punto (o el centro) + vibración. */
export function celebrar(origen = null) {
  const r = origen ? origen.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : innerWidth / 2;
  const y = r ? r.top + r.height / 2 : innerHeight / 2;
  const capa = document.createElement('div');
  capa.className = 'chispas';
  for (let i = 0; i < 26; i++) {
    const c = document.createElement('i');
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 220}px`);
    c.style.setProperty('--dy', `${-60 - Math.random() * 200}px`);
    c.style.setProperty('--t', `${0.7 + Math.random() * 0.6}s`);
    c.style.setProperty('--h', `${15 + Math.random() * 35}`);
    capa.appendChild(c);
  }
  document.body.appendChild(capa);
  setTimeout(() => capa.remove(), 1500);
  if (navigator.vibrate) navigator.vibrate(40);
}

/**
 * Abre una ventana de diálogo.
 * @param {string} html  Contenido.
 * @param {Array} botones [{ texto, valor, clase }]
 * @returns {Promise} el `valor` del botón pulsado (o null si se cierra).
 * Si el contenido tiene campos con name, `alCerrar(form)` puede leerlos.
 * `alAbrir(dialog)` se llama al abrirse (para añadir comportamiento, p. ej. cálculos en directo).
 */
export function dialogo(html, botones = [{ texto: 'Vale', valor: true, clase: 'primario' }], alCerrar, alAbrir) {
  return new Promise((resolver) => {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog" class="dialogo">
      <div class="dialogo-cuerpo">${html}</div>
      <div class="dialogo-botones">
        ${botones.map((b, i) => `<button class="boton ${b.clase || ''}" value="${i}">${esc(b.texto)}</button>`).join('')}
      </div></form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => {
      const i = d.returnValue;
      const boton = i !== '' && i != null ? botones[Number(i)] : null;
      const valor = boton ? boton.valor : null;
      const extra = alCerrar ? alCerrar(d.querySelector('form'), valor) : undefined;
      d.remove();
      resolver(extra !== undefined ? extra : valor);
    });
    d.showModal();
    if (alAbrir) alAbrir(d);
    const primero = d.querySelector('input, textarea, select');
    if (primero) primero.focus();
  });
}

export const confirmar = (texto, si = 'Sí', no = 'Cancelar') =>
  dialogo(`<p>${texto}</p>`, [{ texto: no, valor: false }, { texto: si, valor: true, clase: 'primario' }]);

export const avisar = (texto) => dialogo(`<p>${texto}</p>`);

/** Pide un texto. Devuelve el texto o null si se cancela. */
export function pedirTexto(pregunta, { valor = '', placeholder = '', tipo = 'text', aceptar = 'Guardar', cancelar = 'Cancelar' } = {}) {
  return dialogo(
    `<label class="campo"><span>${pregunta}</span>
      <input name="respuesta" type="${tipo}" value="${esc(valor)}" placeholder="${esc(placeholder)}" ${tipo === 'number' ? 'inputmode="numeric" min="0"' : ''}></label>`,
    [{ texto: cancelar, valor: false }, { texto: aceptar, valor: true, clase: 'primario' }],
    (form, ok) => (ok ? form.respuesta.value.trim() : null),
  );
}
