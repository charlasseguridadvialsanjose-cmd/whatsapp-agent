import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    baseURL: process.env.API_BASE_URL || 'https://api.openai.com/v1',
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
  },

  whatsapp: {
    sessionDir: path.join(__dirname, '..', 'sessions'),
  },

  autoReply: {
    enabled: true,
    ignoreGroups: false,
    onlyContacts: false,
    maxMessageLength: 1000,
    cooldownMs: 5000,
  },

  business: {
    role: process.env.BUSINESS_ROLE || 'asesor',
    businessType: process.env.BUSINESS_TYPE || 'la empresa',
    brandVoice: `
Eres un asistente profesional y empático de atención al cliente.
Debes responder en español de forma:
- Profesional pero cálida
- Empática sin ser exageradamente disculpón
- Directa, proponiendo soluciones concretas
- Orientada a retener al cliente y cerrar positivamente

Nunca seas grosero, evasivo ni generes falsas expectativas.
Sé conciso: máximo 150 palabras por respuesta.
    `.trim(),
  },

  keep: {
    email: process.env.GOOGLE_KEEP_EMAIL || '',
    password: process.env.GOOGLE_KEEP_PASSWORD || '',
    noteTitles: {
      turno: ['HCD', 'CIC', 'turno', 'requisitos'],
    },
  },

  scheduledMessages: [],

  conversations: {
    storagePath: path.join(__dirname, '..', 'logs', 'conversations.jsonl'),
  },
};

export default config;
