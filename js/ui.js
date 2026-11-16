// =====================================================================
// ui.js — Pequeñas ayudas para la interfaz: ventanas de diálogo,
// avisos flotantes y escapar texto.
// =====================================================================

/** Evita que un texto escrito por ti se interprete como HTML. */
export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Muestra un aviso breve abajo de la pantalla. */
export function toast(mensaje) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = mensaje;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('visible'), 10);
  setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 2800);
}

/**
 * Abre una ventana de diálogo.
 * @param {string} html  Contenido.
 * @param {Array} botones [{ texto, valor, clase }]
 * @returns {Promise} el `valor` del botón pulsado (o null si se cierra).
 * Si el contenido tiene campos con name, `alCerrar(form)` puede leerlos.
 */
export function dialogo(html, botones = [{ texto: 'Vale', valor: true, clase: 'primario' }], alCerrar) {
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
