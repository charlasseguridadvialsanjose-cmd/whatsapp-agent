import OpenAI from 'openai';
import config from './config.js';
import logger from './logger.js';

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseURL,
    });
  }
  return client;
}

export async function generateResponse(userMessage, context = {}) {
  const { role, businessType, brandVoice } = config.business;

  let keepInfo = '';
  if (context.keepNotes && context.keepNotes.length > 0) {
    keepInfo = '\nInformación obtenida de Google Keep:\n';
    for (const note of context.keepNotes) {
      keepInfo += `--- ${note.title} ---\n${note.text}\n\n`;
    }
  }

  const systemPrompt = `
${brandVoice}

Contexto del negocio:
- Tu rol: ${role}
- Tipo de negocio: ${businessType}
${context.additionalContext ? `- Contexto adicional: ${context.additionalContext}` : ''}
${context.goal ? `- Objetivo de esta respuesta: ${context.goal}` : ''}
${keepInfo}
${context.conversationHistory ? `- Historial reciente de la conversación:\n${context.conversationHistory}` : ''}

Reglas:
1. Responde siempre en español
2. Máximo 150 palabras
3. Sé empático pero profesional, no exageradamente disculpón
4. Propón siempre una solución concreta
5. Termina con un cierre que deje la puerta abierta
6. Si es una queja, valida el sentimiento del cliente antes de defenderte
7. No inventes información ni prometas cosas que no puedas cumplir
8. Mantén un tono conversacional natural, no suenes robótico
9. Si la persona pide un turno, usa la información de Google Keep y las fechas disponibles para guiar la conversación
10. Pedí los requisitos necesarios según el área (HCD o CIC)
11. **Cuando el cliente confirme un turno definitivamente**, agregá AL FINAL de tu respuesta el siguiente marcador para registrar el turno:
---BOOKING:{"area": "HCD", "fecha": "2025-06-15", "hora": "10:00", "nombre": "Nombre del cliente", "requisitos": "Requisitos cumplidos"}---
Reemplazá los datos con los valores reales de la conversación.
`.trim();

  try {
    const completion = await getClient().chat.completions.create({
      model: config.openai.model,
      temperature: config.openai.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Mensaje del cliente: "${userMessage}"` },
      ],
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    logger.error('Error generando respuesta de IA:', { error: error.message });
    throw error;
  }
}

export function isAIConfigured() {
  return !!config.openai.apiKey && config.openai.apiKey !== 'sk-tu-api-key-aqui';
}
