function limpiarNumeroWhatsapp(numero) {
  if (!numero) return '';
  return String(numero).replace(/[^0-9]/g, '');
}

function buildWhatsappLink(numero, texto = '') {
  const numeroLimpio = limpiarNumeroWhatsapp(numero);
  if (!numeroLimpio) return '';
  const textoCodificado = encodeURIComponent(texto);
  return `https://wa.me/${numeroLimpio}?text=${textoCodificado}`;
}

function buildMensajePedido(negocio, formData = {}) {
  const lineas = [];
  lineas.push(`Hola! Vengo desde la web${negocio?.nombre ? ` de ${negocio.nombre}` : ''}.`);
  if (formData.nombre) lineas.push(`*Nombre:* ${formData.nombre}`);
  if (formData.email) lineas.push(`*Email:* ${formData.email}`);
  if (formData.telefono) lineas.push(`*Teléfono:* ${formData.telefono}`);
  if (formData.servicio_solicitado) lineas.push(`*Servicio:* ${formData.servicio_solicitado}`);
  if (formData.fecha_solicitada) lineas.push(`*Fecha deseada:* ${formData.fecha_solicitada}`);
  if (formData.mensaje) lineas.push(`\n*Mensaje:*\n${formData.mensaje}`);
  return lineas.join('\n');
}

function buildMensajeServicio(negocio, servicio = {}) {
  const lineas = [];
  lineas.push(`Hola! Quiero informació sobre:`);
  if (servicio.nombre) lineas.push(`*${servicio.nombre}*`);
  if (servicio.precio) lineas.push(`Precio: $${servicio.precio} ${servicio.moneda || ''}`);
  if (negocio?.nombre) lineas.push(`\nWeb de ${negocio.nombre}`);
  return lineas.join('\n');
}

module.exports = {
  buildWhatsappLink,
  buildMensajePedido,
  buildMensajeServicio,
  limpiarNumeroWhatsapp,
};
