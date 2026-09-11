const env = require('../config/env');
const logger = require('./logger');
const { buildWhatsappLink, buildMensajeServicio } = require('../utils/whatsapp');

function detectarIntencion(pregunta) {
  const p = pregunta.toLowerCase();

  if (/^(hola|buen[oa]s?.?(dias|tardes|noches)?|qué tal|como andas|holaa+|hey|hi|hello)/i.test(p)) {
    return 'saludo';
  }

  if (/^(chau|adios|hasta luego|nos vemos|bye|gracias y chau|gracias, chau)/i.test(p)) {
    return 'despedida';
  }

  if (/(turno|cita|reservar|agendar|pedir hora|sacar turno|horario para|disponibl)/i.test(p)) {
    return 'solicitar_turno';
  }

  if (/(precio|cuanto cuesta|cuánto cuesta|precio de|valor de|cuesta|tarifa|costo)/i.test(p)) {
    return 'consulta_precio';
  }

  if (/(servicio|que servicio|qué servicio|ofrecen|hace[nr]?|realizan|tienen.*servicio)/i.test(p)) {
    return 'consultar_servicio';
  }

  if (/(whatsapp|numero|número|teléfono|telefono|contactar|contacto|me contact|llamar)/i.test(p)) {
    return 'informacion_contacto';
  }

  if (/(dirección|direccion|ubicacion|ubicación|donde esta|dónde está|lugar|localidad|ciudad|zona)/i.test(p)) {
    return 'ubicacion';
  }

  if (/(horario|atencion|atención|abierto|abren|a que hora|a qué hora)/i.test(p)) {
    return 'horario';
  }

  if (/(recomendar|recomiendan|que me [a-z]+|qué me [a-z]+|sugerencia|sugerir|me conviene|cual elijo|cuál elijo)/i.test(p)) {
    return 'recomendacion';
  }

  if (/(faq|pregunta.*frecuente|duda|siempre pregunto)/i.test(p)) {
    return 'faq';
  }

  return 'general';
}

function armarContextoRAG(negocio, servicios = [], faqs = []) {
  const partes = [];
  partes.push(`=== INFORMACIÓN DEL NEGOCIO ===`);
  if (negocio?.nombre) partes.push(`Nombre: ${negocio.nombre}`);
  if (negocio?.tagline) partes.push(`Tagline: ${negocio.tagline}`);
  if (negocio?.descripcion) partes.push(`Descripción: ${negocio.descripcion}`);
  if (negocio?.whatsapp) partes.push(`WhatsApp: ${negocio.whatsapp}`);
  if (negocio?.email) partes.push(`Email: ${negocio.email}`);
  if (negocio?.telefono) partes.push(`Teléfono: ${negocio.telefono}`);
  if (negocio?.direccion) partes.push(`Dirección: ${negocio.direccion}`);
  if (negocio?.ciudad) partes.push(`Ciudad: ${negocio.ciudad}`);

  let horarioStr = '';
  if (negocio?.horario_json) {
    try {
      const h = typeof negocio.horario_json === 'string' ? JSON.parse(negocio.horario_json) : negocio.horario_json;
      horarioStr = Object.entries(h).map(([d, v]) => `${d}: ${v}`).join(', ');
    } catch {}
  }
  if (horarioStr) partes.push(`Horarios: ${horarioStr}`);
  if (negocio?.ia_conocimiento) partes.push(`Conocimiento extra: ${negocio.ia_conocimiento}`);

  if (servicios && servicios.length) {
    partes.push(`\n=== SERVICIOS DISPONIBLES ===`);
    for (const s of servicios) {
      const precio = s.precio ? `$${s.precio} ${s.moneda || ''}` : 'Consultar';
      partes.push(`- ${s.nombre}: ${s.descripcion || 'Sin descripción'}. Precio: ${precio}${s.categoria ? `. Categoría: ${s.categoria}` : ''}${s.destacado ? ' ⭐Destacado' : ''}`);
    }
  }

  if (faqs && faqs.length) {
    partes.push(`\n=== PREGUNTAS FRECUENTES ===`);
    for (const f of faqs) partes.push(`P: ${f.pregunta}\nR: ${f.respuesta}`);
  }

  return partes.join('\n');
}

function sugerenciasPorIntencion(intencion, contexto) {
  const base = ['Ver servicios', 'Pedir turno por WhatsApp', 'Contactar'];
  switch (intencion) {
    case 'saludo':
      return ['¿Qué servicios ofrecen?', 'Ver horarios', 'Pedir turno'];
    case 'consulta_precio':
    case 'consultar_servicio':
      return ['Pedir turno por WhatsApp', 'Ver más servicios', 'Consultar otro servicio'];
    case 'solicitar_turno':
      return ['Hablar por WhatsApp', 'Ver disponibilidad', 'Más información del servicio'];
    case 'ubicacion':
    case 'horario':
    case 'informacion_contacto':
      return ['Ver servicios', 'Pedir turno', 'Volver al inicio'];
    case 'recomendacion':
      return ['Pedir turno por WhatsApp', 'Más detalles', 'Ver todos los servicios'];
    case 'despedida':
      return [];
    default:
      return base;
  }
}

function respuestaReglasSimbolicas(intencion, pregunta, negocio, servicios = [], faqs = []) {
  const hayWhatsapp = !!negocio?.whatsapp;

  switch (intencion) {
    case 'saludo': {
      let msj = `¡Hola! Bienvenido${negocio?.nombre ? ` a ${negocio.nombre}` : ''} 😊\n`;
      if (negocio?.tagline) msj += `${negocio.tagline}\n`;
      msj += `¿En qué puedo ayudarte hoy?`;
      return { respuesta: msj, sugerencias: sugerenciasPorIntencion(intencion) };
    }

    case 'despedida': {
      let msj = `¡Gracias por contactarte${negocio?.nombre ? ` con ${negocio.nombre}` : ''}! 💙`;
      if (hayWhatsapp) msj += `\nSi necesitas algo más, no dudes en escribirnos por WhatsApp.`;
      msj += `\n¡Hasta pronto! 👋`;
      return { respuesta: msj, sugerencias: sugerenciasPorIntencion(intencion) };
    }

    case 'consulta_precio': {
      if (!servicios.length) {
        return {
          respuesta: `Actualmente no tenemos servicios publicados. Por favor,${hayWhatsapp ? ' contáctanos por WhatsApp para' : ' envía un formulario y'} consultar disponibilidad y precios.`,
          sugerencias: sugerenciasPorIntencion(intencion),
          mostrarWhatsapp: hayWhatsapp,
        };
      }
      const match = servicios.find(s =>
        pregunta.toLowerCase().includes(s.nombre.toLowerCase()) ||
        (s.categoria && pregunta.toLowerCase().includes(s.categoria.toLowerCase()))
      );
      if (match) {
        const precio = match.precio ? `$${match.precio} ${match.moneda || ''}` : 'Precio a convenir';
        let msj = `💼 *${match.nombre}*\n`;
        if (match.descripcion) msj += `${match.descripcion}\n`;
        msj += `💰 Precio: ${precio}\n\n`;
        msj += `¿Te interesa? Podemos reservarte un turno por WhatsApp ahora mismo.`;
        return {
          respuesta: msj,
          sugerencias: sugerenciasPorIntencion(intencion),
          mostrarWhatsapp: hayWhatsapp,
          accion: { tipo: 'mostrar_servicio', servicio: match },
        };
      }
      let msj = `Nuestros servicios y precios son:\n`;
      for (const s of servicios) {
        const precio = s.precio ? `$${s.precio} ${s.moneda || ''}` : 'Consultar';
        msj += `• ${s.nombre}: ${precio}\n`;
      }
      msj += `\nSi uno te interesa, puedo generarte el link directo a WhatsApp para coordinar un turno 😊`;
      return {
        respuesta: msj,
        sugerencias: sugerenciasPorIntencion(intencion),
        mostrarWhatsapp: hayWhatsapp,
      };
    }

    case 'consultar_servicio': {
      if (!servicios.length) {
        return { respuesta: `Actualmente no tenemos servicios publicados.`, sugerencias: sugerenciasPorIntencion(intencion) };
      }
      const match = servicios.find(s =>
        pregunta.toLowerCase().includes(s.nombre.toLowerCase()) ||
        (s.categoria && pregunta.toLowerCase().includes(s.categoria.toLowerCase()))
      );
      if (match) {
        let msj = `✅ *${match.nombre}*\n`;
        if (match.descripcion) msj += `${match.descripcion}\n`;
        if (match.precio) msj += `\nPrecio: $${match.precio} ${match.moneda || ''}`;
        msj += `\n\n¿Querés más información o coordinamos un turno por WhatsApp?`;
        return {
          respuesta: msj,
          sugerencias: sugerenciasPorIntencion(intencion),
          mostrarWhatsapp: hayWhatsapp,
          accion: { tipo: 'mostrar_servicio', servicio: match },
        };
      }
      let msj = `Estos son los servicios que ofrecemos actualmente:\n\n`;
      const activos = servicios.filter(s => s.activo);
      for (const s of activos.slice(0, 8)) msj += `🔹 ${s.nombre}${s.destacado ? ' ⭐' : ''}\n`;
      if (activos.length > 8) msj += `\n... y ${activos.length - 8} más!`;
      msj += `\nDecime cuál te interesa para darte detalles 😊`;
      return {
        respuesta: msj,
        sugerencias: sugerenciasPorIntencion(intencion),
        mostrarWhatsapp: hayWhatsapp,
      };
    }

    case 'solicitar_turno': {
      let msj = `¡Excelente decisión! 📅\n`;
      if (hayWhatsapp) {
        msj += `La forma más rápida de coordinar tu turno es por WhatsApp. Te atenderemos en minutos.\n\n`;
        msj += `¿Te gustaría que te abra el chat ahora?`;
      } else {
        msj += `Por favor, completá el formulario de contacto y nos comunicaremos para coordinar tu turno.`;
      }
      return {
        respuesta: msj,
        sugerencias: sugerenciasPorIntencion(intencion),
        mostrarWhatsapp: true,
        accion: { tipo: 'solicitar_turno' },
      };
    }

    case 'informacion_contacto': {
      let msj = `📞 Datos de contacto:\n`;
      if (negocio?.whatsapp) msj += `WhatsApp: ${negocio.whatsapp}\n`;
      if (negocio?.telefono) msj += `Teléfono: ${negocio.telefono}\n`;
      if (negocio?.email) msj += `Email: ${negocio.email}\n`;
      return { respuesta: msj, sugerencias: sugerenciasPorIntencion(intencion), mostrarWhatsapp: hayWhatsapp };
    }

    case 'ubicacion': {
      let msj = `📍 Ubicación:\n`;
      if (negocio?.direccion) msj += `${negocio.direccion}\n`;
      if (negocio?.ciudad) msj += `${negocio.ciudad}\n`;
      if (!negocio?.direccion && !negocio?.ciudad) msj += `Te pasamos los detalles por WhatsApp!`;
      return { respuesta: msj, sugerencias: sugerenciasPorIntencion(intencion), mostrarWhatsapp: hayWhatsapp };
    }

    case 'horario': {
      let msj = `🕒 Horarios de atención:\n`;
      if (negocio?.horario_json) {
        try {
          const h = typeof negocio.horario_json === 'string' ? JSON.parse(negocio.horario_json) : negocio.horario_json;
          for (const [dia, horario] of Object.entries(h)) {
            msj += `• ${dia.charAt(0).toUpperCase() + dia.slice(1)}: ${horario}\n`;
          }
        } catch {
          msj += `Te los pasamos por WhatsApp!`;
        }
      } else {
        msj += `Te los pasamos por WhatsApp!`;
      }
      return { respuesta: msj, sugerencias: sugerenciasPorIntencion(intencion), mostrarWhatsapp: hayWhatsapp };
    }

    case 'recomendacion': {
      if (!servicios.length) {
        return { respuesta: `Sin servicios publicados aún.`, sugerencias: sugerenciasPorIntencion(intencion) };
      }
      const destacados = servicios.filter(s => s.destacado && s.activo);
      const pool = destacados.length ? destacados : servicios.filter(s => s.activo);
      const top = pool.slice(0, 3);
      let msj = `💡 Te recomiendo:\n\n`;
      for (const s of top) {
        const precio = s.precio ? ` - $${s.precio}` : '';
        msj += `🌟 ${s.nombre}${precio}\n`;
        if (s.descripcion) msj += `   ${s.descripcion.slice(0, 120)}${s.descripcion.length > 120 ? '...' : ''}\n\n`;
      }
      msj += `¿Querés saber más sobre alguno o coordinar un turno?`;
      return {
        respuesta: msj,
        sugerencias: sugerenciasPorIntencion(intencion),
        mostrarWhatsapp: hayWhatsapp,
        accion: { tipo: 'mostrar_recomendaciones', servicios: top },
      };
    }

    case 'faq': {
      if (!faqs.length) {
        return { respuesta: `No hay preguntas frecuentes cargadas.`, sugerencias: sugerenciasPorIntencion(intencion) };
      }
      let msj = `❓ Preguntas frecuentes:\n\n`;
      for (const f of faqs.slice(0, 5)) msj += `Q: ${f.pregunta}\nA: ${f.respuesta}\n\n`;
      return { respuesta: msj, sugerencias: sugerenciasPorIntencion(intencion) };
    }

    default: {
      let msj = `¡Gracias por tu pregunta! 😊\n\n`;
      if (faqs.length) {
        const hit = faqs.find(f =>
          pregunta.split(/\s+/).some(p => p.length > 3 && (
            f.pregunta.toLowerCase().includes(p.toLowerCase()) ||
            f.respuesta.toLowerCase().includes(p.toLowerCase())
          ))
        );
        if (hit) {
          msj += `Tal vez te sirva esta respuesta:\n\n*${hit.pregunta}*\n${hit.respuesta}\n\n`;
        }
      }
      msj += `Si querés atención personalizada, escribinos por WhatsApp y te respondemos enseguida!`;
      return {
        respuesta: msj,
        sugerencias: sugerenciasPorIntencion(intencion),
        mostrarWhatsapp: hayWhatsapp,
      };
    }
  }
}

async function llamarOpenAI(contexto, historial, preguntaUsuario) {
  if (!env.OPENAI_API_KEY) return null;

  const systemPrompt = `Eres un asistente virtual cordial, profesional y útil para un negocio local.
Tu objetivo es responder preguntas usando ÚNICAMENTE la información del contexto de abajo.
Nunca inventes datos, precios, ni información no incluida en el contexto.

Tonos: amable, cercano, persuasivo pero honesto. Usa emojis con moderación.

Si el usuario quiere turno/contacto: sugiere WhatsApp.
Si no sabes la respuesta: di claramente que no tienes esa info y recomienda consultar por WhatsApp o formulario.

Responde siempre en español, en formato markdown amigable.
Devuelve tus respuestas listas para mostrar al usuario final.

---
${contexto}
---

`;

  const mensajes = [{ role: 'system', content: systemPrompt }];
  if (Array.isArray(historial)) {
    for (const m of historial.slice(-8)) {
      if (m?.role && m?.content) mensajes.push({ role: m.role, content: String(m.content).slice(0, 2000) });
    }
  }
  mensajes.push({ role: 'user', content: String(preguntaUsuario).slice(0, 1000) });

  const body = {
    model: env.OPENAI_MODEL,
    messages: mensajes,
    max_tokens: env.IA_MAX_TOKENS,
    temperature: 0.5,
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      logger.warn(`OpenAI error ${res.status}: ${txt.slice(0, 500)}`);
      return null;
    }
    const json = await res.json();
    return json?.choices?.[0]?.message?.content || null;
  } catch (err) {
    logger.error('Error llamando OpenAI:', err.message);
    return null;
  }
}

async function responderPregunta(negocio, historial, preguntaUsuario, servicios = [], faqs = []) {
  const pregunta = String(preguntaUsuario || '').trim();
  if (!pregunta) {
    return { respuesta: 'Por favor, escribí tu mensaje 😊', sugerencias: [] };
  }

  const intencion = detectarIntencion(pregunta);
  const contexto = armarContextoRAG(negocio, servicios, faqs);
  const reglas = respuestaReglasSimbolicas(intencion, pregunta, negocio, servicios, faqs);

  let respuestaIA = null;
  if (env.OPENAI_API_KEY) {
    try {
      respuestaIA = await llamarOpenAI(contexto, historial, pregunta);
    } catch (err) {
      logger.error('Fallo IA:', err);
      respuestaIA = null;
    }
  }

  const respuestaFinal = {
    ...reglas,
    respuesta: respuestaIA || reglas.respuesta,
    intencion,
  };

  if (negocio?.whatsapp && (
    intencion === 'solicitar_turno' ||
    intencion === 'consulta_precio' ||
    respuestaFinal.mostrarWhatsapp
  )) {
    try {
      const texto = buildMensajeServicio(negocio, {});
      respuestaFinal.whatsappLink = buildWhatsappLink(negocio.whatsapp, texto);
      respuestaFinal.mostrarWhatsapp = true;
    } catch {}
  }

  if (!respuestaFinal.sugerencias) {
    respuestaFinal.sugerencias = sugerenciasPorIntencion(intencion);
  }

  return respuestaFinal;
}

module.exports = {
  responderPregunta,
  detectarIntencion,
  armarContextoRAG,
};
