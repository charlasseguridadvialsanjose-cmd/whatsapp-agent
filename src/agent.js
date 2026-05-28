import logger from './logger.js';
import { generateResponse } from './ai.js';
import KeepClient from './keepClient.js';
import config from './config.js';
import { getConfig, getAvailableDates, bookAppointment } from './database.js';

const BOOKING_MARKER = '---BOOKING:';
const INIT_TIMEOUT = 10000;

class Agent {
  constructor() {
    this.keep = new KeepClient();
    this.keepReady = false;
    this.recentMessages = new Map();
    this.cooldowns = new Map();
    this.pendingConfirmations = new Map();
  }

  async init() {
    if (!config.keep.email || !config.keep.password) {
      logger.info('Google Keep no configurado (sin credenciales en .env)');
      return;
    }

    const timeout = setTimeout(() => {
      logger.warn('Timeout inicializando Google Keep (15s) — continuando sin Keep');
    }, INIT_TIMEOUT);

    try {
      await this.keep.start();
      const loginResult = await this.keep.login(config.keep.email, config.keep.password);
      clearTimeout(timeout);

      if (loginResult.success) {
        this.keepReady = true;
        logger.info('Google Keep conectado correctamente');
        try {
          const labels = await this.keep.listLabels();
          if (labels.success) {
            logger.info(`Etiquetas disponibles: ${labels.labels.map(l => l.name).join(', ')}`);
          }
        } catch (_) {}
      } else {
        logger.warn('Google Keep no conectado:', { error: loginResult.error });
      }
    } catch (error) {
      clearTimeout(timeout);
      logger.warn('Google Keep no disponible:', { error: error.message });
    }
  }

  async processMessage(message, from, name) {
    const now = Date.now();
    const cooldown = this.cooldowns.get(from) || 0;
    if (now < cooldown) return null;

    try {
      const conversationHistory = this.buildHistory(from, message, now);
      const keepNotes = this.keepReady ? await this.fetchRelevantNotes(message) : [];
      const appointmentInfo = this.buildAppointmentContext(message);
      const instructions = this.buildInstructions(message);
      const bookingData = this.pendingConfirmations.get(from);

      const context = {
        keepNotes,
        conversationHistory,
        appointmentInfo,
        additionalContext: instructions,
        bookingData,
        goal: 'Gestionar turnos y consultas de forma rápida y profesional',
      };

      let response = await generateResponse(message, context);

      this.recentMessages.set(from, { message, response, timestamp: now });
      this.cooldowns.set(from, now + config.autoReply.cooldownMs);

      const bookingResult = this.processBookingMarker(response, from, name);
      if (bookingResult) {
        response = response.replace(/---BOOKING:.*?---/s, '').trim();
        response += `\n\n✅ Turno registrado: *${bookingResult.area}* el *${bookingResult.fecha}* (cupo confirmado)`;
        logger.info(`Turno registrado: ${bookingResult.area} ${bookingResult.fecha} - ${name} (${from})`);
      }

      return response;
    } catch (error) {
      logger.error(`Error en processMessage para ${name} (${from}):`, { error: error.message, stack: error.stack });
      return 'Ocurrió un error al procesar tu mensaje. Por favor intentá de nuevo.';
    }
  }

  processBookingMarker(response, from, name) {
    const match = response.match(/---BOOKING:(.*?)---/s);
    if (!match) return null;

    try {
      const data = JSON.parse(match[1].trim());
      const area = data.area || 'HCD';
      const fecha = data.fecha;

      if (!fecha) {
        logger.warn('Booking marker sin fecha:', { from, data });
        return null;
      }

      bookAppointment({
        area,
        nombre: data.nombre || name || 'Desconocido',
        telefono: from,
        fecha_turno: fecha,
        hora_turno: data.hora || null,
        requisitos_cumplidos: data.requisitos || '',
        notas: `WhatsApp. ${data.notas || ''}`,
      });

      this.pendingConfirmations.delete(from);
      return { area, fecha };
    } catch (e) {
      logger.error('Error procesando booking marker:', { error: e.message, response: match[1] });
      return null;
    }
  }

  buildAppointmentContext(message) {
    try {
      const lower = message.toLowerCase();
      let area = null;
      if (lower.includes('hcd') || lower.includes('concejo') || lower.includes('deliberante')) area = 'HCD';
      if (lower.includes('cic') || lower.includes('brillante')) area = 'CIC';
      if (!area) return '';

      const available = getAvailableDates(area);
      if (available.length === 0) {
        return `No hay fechas disponibles para ${area} en este momento.`;
      }

      return `Fechas disponibles para ${area}: ${available.map(d =>
        `${d.fecha} (${d.hora_inicio}-${d.hora_fin}, ${d.cupo_maximo - d.cupos_usados} cupos libres)`
      ).join(', ')}`;
    } catch (error) {
      logger.error('Error en buildAppointmentContext:', { error: error.message });
      return '';
    }
  }

  buildInstructions(message) {
    try {
      const lower = message.toLowerCase();
      const parts = [];

      const rules = getConfig('appointmentRules', '');
      if (rules) parts.push(`Reglas de turnos:\n${rules}`);

      if (lower.includes('hcd') || lower.includes('concejo') || lower.includes('deliberante')) {
        const hcd = getConfig('hcdInstructions', '');
        if (hcd) parts.push(`Instrucciones para HCD:\n${hcd}`);
      }
      if (lower.includes('cic') || lower.includes('brillante')) {
        const cic = getConfig('cicInstructions', '');
        if (cic) parts.push(`Instrucciones para CIC:\n${cic}`);
      }

      return parts.join('\n\n');
    } catch (error) {
      logger.error('Error en buildInstructions:', { error: error.message });
      return '';
    }
  }

  buildHistory(from, currentMessage, now) {
    try {
      const last = this.recentMessages.get(from);
      if (last && (now - last.timestamp) < 120000) {
        return `Historial reciente:\nTú: "${last.response}"\nCliente: "${currentMessage}"`;
      }
      return '';
    } catch {
      return '';
    }
  }

  async fetchRelevantNotes(message) {
    try {
      const lowerMsg = message.toLowerCase();
      const keywords = ['turno', 'hcd', 'cic', 'concejo', 'deliberante', 'brillante', 'requisito'];
      const matched = keywords.filter(k => lowerMsg.includes(k));
      if (matched.length === 0) return [];

      const queries = [...new Set(matched.map(k => {
        if (k.includes('hcd') || k.includes('concejo') || k.includes('deliberante')) return 'HCD';
        if (k.includes('cic') || k.includes('brillante')) return 'CIC';
        return 'turno';
      }))];

      const notes = [];
      for (const q of queries) {
        try {
          const result = await this.keep.searchNotes(q);
          if (result.success) {
            for (const n of result.notes) {
              if (!notes.find(x => x.id === n.id)) notes.push(n);
            }
          }
        } catch (e) {
          logger.warn(`Error buscando "${q}" en Keep:`, { error: e.message });
        }
      }
      return notes;
    } catch (error) {
      logger.warn('Error en fetchRelevantNotes:', { error: error.message });
      return [];
    }
  }

  async shutdown() {
    if (this.keep) await this.keep.close();
  }
}

export default Agent;
