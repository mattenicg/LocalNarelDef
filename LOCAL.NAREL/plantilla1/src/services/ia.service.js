const { fetchOne, fetchAll } = require('../db');
const {
  OPENAI_API_KEY,
  OPENAI_MODEL,
  IA_MAX_TOKENS
} = require('../config');
const logger = require('../utils/logger');

function armarContextoNegocio(tenant) {
  const row = fetchOneSafe('SELECT json FROM tenant_config WHERE tenant_id = ?', [tenant.id]);
  const config = row ? JSON.parse(row.json || '{}') : {};
  const servicios = fetchAllSafe('SELECT * FROM services WHERE tenant_id = ? AND activo = 1 ORDER BY orden ASC', [tenant.id]);
  const faqs = fetchAllSafe('SELECT * FROM faq WHERE tenant_id = ? AND activo = 1 ORDER BY orden ASC', [tenant.id]);
  const knowledge = fetchAllSafe('SELECT categoria, contenido FROM ia_knowledge WHERE tenant_id = ? AND activo = 1', [tenant.id]);

  let contexto = `=== NEGOCIO ===\nNombre: ${tenant.nombre}\n`;
  if (tenant.whatsapp) contexto += `WhatsApp: ${tenant.whatsapp}\n`;
  if (tenant.email_contacto) contexto += `Email: ${tenant.email_contacto}\n`;
  if (tenant.dominio) contexto += `Sitio web: ${tenant.dominio}\n`;
  if (config.direccion) contexto += `Dirección: ${config.direccion}\n`;
  if (config.ubicacion_url) contexto += `Ubicación URL: ${config.ubicacion_url}\n`;
  if (config.horarios && config.horarios.length) {
    contexto += `\n=== HORARIOS ===\n`;
    config.horarios.forEach((h) => (contexto += `  ${h.dia}: ${h.horario}\n`));
  }
  if (servicios.length) {
    contexto += `\n=== SERVICIOS ===\n`;
    servicios.forEach((s) => {
      contexto += `  - ${s.nombre}${s.categoria ? ` [${s.categoria}]` : ''}: $${s.precio || 0}`;
      if (s.duracion_min) contexto += ` (${s.duracion_min} min)`;
      if (s.descripcion) contexto += ` - ${s.descripcion}`;
      if (s.destacado) contexto += ` ★ DESTACADO`;
      contexto += `\n`;
    });
  }
  if (faqs.length) {
    contexto += `\n=== PREGUNTAS FRECUENTES ===\n`;
    faqs.forEach((f) => (contexto += `  Q: ${f.pregunta}\n  A: ${f.respuesta || ''}\n\n`));
  }
  if (knowledge.length) {
    const grupos = {};
    knowledge.forEach((k) => {
      const cat = k.categoria || 'general';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(k.contenido);
    });
    contexto += `\n=== INFORMACIÓN ADICIONAL ===\n`;
    for (const [cat, items] of Object.entries(grupos)) {
      contexto += `  [${cat.toUpperCase()}]:\n`;
      items.forEach((c) => (contexto += `    - ${c}\n`));
    }
  }
  if (config.redes) {
    contexto += `\n=== REDES ===\n`;
    if (config.redes.ig) contexto += `  Instagram: ${config.redes.ig}\n`;
    if (config.redes.fb) contexto += `  Facebook: ${config.redes.fb}\n`;
    if (config.redes.web) contexto += `  Web: ${config.redes.web}\n`;
  }
  return { contexto, config, servicios, faqs };
}

function fetchOneSafe(sql, params) {
  try {
    return fetchOne(sql, params);
  } catch (e) {
    logger.error('fetchOneSafe:', e);
    return null;
  }
}
function fetchAllSafe(sql, params) {
  try {
    return fetchAll(sql, params);
  } catch (e) {
    logger.error('fetchAllSafe:', e);
    return [];
  }
}

function detectarIntencion(mensaje) {
  const m = (mensaje || '').toLowerCase();
  const tiene = (palabras) => palabras.some((p) => m.includes(p));

  if (tiene(['precio', 'precios', 'cuesta', 'cuánto vale', 'valor', 'coste', 'costo'])) return 'precios';
  if (tiene(['horario', 'horarios', 'abren', 'abierto', 'cerrado', 'atención'])) return 'horarios';
  if (tiene(['dirección', 'direccion', 'ubicación', 'ubicacion', 'dónde quedan', 'dónde esta', 'donde', 'local'])) return 'direccion';
  if (tiene(['contacto', 'contactar', 'hablar', 'comunicar', 'teléfono', 'telefono', 'mail', 'email'])) return 'contacto';
  if (tiene(['presupuesto', 'presupuestar', 'cotización', 'cotizacion', 'costo estimado'])) return 'presupuesto';
  if (tiene(['turno', 'turnos', 'reservar', 'reserva', 'agendar', 'agenda', 'pedir cita', 'cita'])) return 'turno';
  if (tiene(['recomienda', 'recomendar', 'sugerir', 'sugerencia', 'me conviene', 'qué servicio', 'que servicio', 'producto'])) return 'recomendacion';
  return 'general';
}

function generarWhatsAppURL(tenant_whatsapp, texto) {
  if (!tenant_whatsapp) return null;
  const num = String(tenant_whatsapp).replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(texto || 'Hola, quiero más información')}`;
}

async function llamarOpenAI(systemPrompt, historial, mensaje) {
  const mensajes = [{ role: 'system', content: systemPrompt }, ...(historial || []), { role: 'user', content: mensaje }];
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: mensajes,
        temperature: 0.3,
        max_tokens: IA_MAX_TOKENS
      })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      logger.error('OpenAI error status', resp.status, txt);
      return null;
    }
    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    return reply.trim();
  } catch (err) {
    logger.error('Error OpenAI fetch:', err);
    return null;
  }
}

function armarRespuestaHeuristica(intencion, contextoData, mensajeUsuario) {
  const { config, servicios, faqs } = contextoData;
  const tenant = contextoData.tenant;
  const waCierre = `Si tenés más dudas escribinos por WhatsApp.`;
  const waLink = generarWhatsAppURL(tenant?.whatsapp, 'Hola, vengo del sitio web y necesito más información.');

  switch (intencion) {
    case 'precios': {
      if (!servicios.length) return `Actualmente no tenemos servicios listados. ${waCierre}`;
      let r = `Nuestros servicios y precios actuales:\n\n`;
      servicios.forEach((s) => {
        r += `✅ *${s.nombre}*: $${s.precio || 0}`;
        if (s.duracion_min) r += ` (${s.duracion_min} min)`;
        if (s.descripcion) r += ` - ${s.descripcion}`;
        r += `\n`;
      });
      r += `\n${waCierre}`;
      return r;
    }
    case 'horarios': {
      if (!config.horarios || !config.horarios.length) return `Los horarios de atención podés consultarlos por WhatsApp. ${waCierre}`;
      let r = `Nuestros horarios de atención son:\n\n`;
      config.horarios.forEach((h) => (r += `🕒 ${h.dia}: ${h.horario}\n`));
      r += `\n${waCierre}`;
      return r;
    }
    case 'direccion': {
      let r = `Estamos ubicados en:\n`;
      if (config.direccion) r += `📍 ${config.direccion}\n`;
      if (config.ubicacion_url) r += `🗺️ Mapa: ${config.ubicacion_url}\n`;
      if (!config.direccion && !config.ubicacion_url) return `Te podemos compartir la dirección exacta por WhatsApp. ${waCierre}`;
      r += `\n${waCierre}`;
      return r;
    }
    case 'contacto': {
      let r = `Nuestros datos de contacto:\n`;
      if (tenant.whatsapp) r += `📱 WhatsApp: ${tenant.whatsapp}\n`;
      if (tenant.email_contacto) r += `📧 Email: ${tenant.email_contacto}\n`;
      if (config.direccion) r += `📍 ${config.direccion}\n`;
      r += `\n${waCierre}`;
      return r;
    }
    case 'presupuesto':
    case 'turno': {
      return `Perfecto! Para solicitar un ${intencion === 'presupuesto' ? 'presupuesto personalizado' : 'turno'} por favor escribinos por WhatsApp y coordinamos.`;
    }
    case 'recomendacion': {
      if (!servicios.length) return `Podemos recomendarte mejor por WhatsApp. ${waCierre}`;
      const destacados = servicios.filter((s) => s.destacado);
      const lista = destacados.length ? destacados : servicios.slice(0, 3);
      let r = `Te recomendamos nuestros servicios más buscados:\n\n`;
      lista.forEach((s) => (r += `⭐ *${s.nombre}* - $${s.precio || 0}\n   ${s.descripcion || ''}\n\n`));
      r += `Para más detalles escribinos por WhatsApp.`;
      return r;
    }
    default: {
      if (faqs && faqs.length) {
        const palabras = (mensajeUsuario || '').toLowerCase().split(/\s+/).filter((p) => p.length > 3);
        const matches = faqs.filter((f) =>
          palabras.some((p) => (f.pregunta || '').toLowerCase().includes(p) || (f.respuesta || '').toLowerCase().includes(p))
        );
        if (matches.length) {
          let r = `Quizás te sirva esta información:\n\n`;
          matches.slice(0, 3).forEach((f) => (r += `❓ ${f.pregunta}\n   ${f.respuesta || ''}\n\n`));
          r += waCierre;
          return r;
        }
      }
      return `Gracias por tu consulta! Por detalles específicos te recomendamos escribirnos por WhatsApp para que te ayudemos mejor.`;
    }
  }
}

function armarSugerencias(intencion) {
  const base = ['Consultar precios', 'Ver horarios', 'Solicitar turno', 'Pedir presupuesto'];
  switch (intencion) {
    case 'precios':
      return ['Pedir presupuesto', 'Ver horarios', 'Reservar turno'];
    case 'horarios':
      return ['Ver dirección', 'Consultar precios', 'Solicitar turno'];
    case 'direccion':
      return ['Ver horarios', 'Pedir presupuesto', 'Consultar precios'];
    case 'presupuesto':
    case 'turno':
      return ['Ver servicios', 'Consultar precios', 'Contactar'];
    default:
      return base;
  }
}

async function procesarMensajeIA(tenant, historial, mensaje) {
  const contextoData = armarContextoNegocio(tenant);
  contextoData.tenant = tenant;
  const intencion = detectarIntencion(mensaje);

  let respuesta = '';
  const systemPrompt =
    `Eres un asistente virtual experto del negocio "${tenant.nombre}". Responde en español de manera clara, amable y breve.\n` +
    `Utiliza ÚNICAMENTE la información del contexto que se te provee a continuación. SI NO SABES ALGO O LA INFORMACIÓN NO ESTÁ, invita amablemente a que escriban por WhatsApp al número que se indica. No inventes datos.\n\n` +
    `${contextoData.contexto}\n\n` +
    `Rol: responde como asesor de ventas del negocio, orientando al cliente. Si la pregunta presupone precios, servicios, turnos o presupuesto, anima a que continúen por WhatsApp.`;

  if (OPENAI_API_KEY) {
    respuesta = await llamarOpenAI(systemPrompt, historial, mensaje);
  }
  if (!respuesta) {
    respuesta = armarRespuestaHeuristica(intencion, contextoData, mensaje);
  }

  const sugerencias = armarSugerencias(intencion);
  let accion_whatsapp_url = null;
  if (intencion === 'presupuesto' || intencion === 'turno') {
    accion_whatsapp_url = generarWhatsAppURL(
      tenant.whatsapp,
      `Hola! Quiero solicitar un ${intencion === 'presupuesto' ? 'presupuesto' : 'turno'} a través del sitio web.`
    );
  }
  return { respuesta, sugerencias, accion_whatsapp_url };
}

module.exports = {
  procesarMensajeIA,
  detectarIntencion,
  armarContextoNegocio,
  generarWhatsAppURL
};
