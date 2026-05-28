import cron from 'node-cron';
import config from './config.js';
import logger from './logger.js';

class MessageScheduler {
  constructor(client) {
    this.client = client;
    this.jobs = new Map();
  }

  addJob({ name, cronExpression, number, message }) {
    if (this.jobs.has(name)) {
      logger.warn(`El trabajo programado "${name}" ya existe. Saltando.`);
      return;
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        const chatId = number.includes('@s.whatsapp.net') ? number : number.includes('@') ? number : `${number}@s.whatsapp.net`;
        await this.client.sendMessage(chatId, { text: message });
        logger.info(`Mensaje programado enviado: "${name}" a ${number}`);
      } catch (error) {
        logger.error(`Error enviando mensaje programado "${name}":`, { error: error.message });
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'America/Argentina/Buenos_Aires',
    });

    this.jobs.set(name, { name, cronExpression, number, message, job });
    logger.info(`Trabajo programado registrado: "${name}" (${cronExpression}) -> ${number}`);
  }

  removeJob(name) {
    const entry = this.jobs.get(name);
    if (entry) {
      entry.job.stop();
      this.jobs.delete(name);
      logger.info(`Trabajo programado eliminado: "${name}"`);
    }
  }

  loadFromConfig() {
    for (const jobConfig of config.scheduledMessages) {
      this.addJob(jobConfig);
    }
  }

  listJobs() {
    const list = [];
    for (const [name, entry] of this.jobs) {
      list.push({
        name,
        cronExpression: entry.cronExpression,
        number: entry.number,
        message: entry.message.substring(0, 50) + '...',
      });
    }
    return list;
  }

  stopAll() {
    for (const [, entry] of this.jobs) {
      entry.job.stop();
    }
    this.jobs.clear();
    logger.info('Todos los trabajos programados detenidos.');
  }
}

export default MessageScheduler;
