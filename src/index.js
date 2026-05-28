import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import config from './config.js';
import logger from './logger.js';
import { isAIConfigured } from './ai.js';
import MessageScheduler from './scheduler.js';
import ConversationLogger from './conversationLogger.js';
import Agent from './agent.js';
import { initDB } from './database.js';
import { startServer } from './server.js';
import { setQR, setConnectionStatus, clearQR } from './state.js';

initDB();

const PORT = parseInt(process.env.PORT || '3000');
startServer(PORT);

const conversationLogger = new ConversationLogger();
const agent = new Agent();
let scheduler = null;

const loggerPino = pino({ level: 'silent' });

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(config.whatsapp.sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['WhatsApp Agent', 'Chrome', '1.0'],
    logger: loggerPino,
    syncFullHistory: false,
    shouldSyncHistory: false,
  });

  sock.ev.on('creds.update', async () => {
    try {
      await saveCreds();
    } catch (e) {
      logger.error('Error guardando credenciales:', { error: e.message });
    }
  });

  let lastQrLog = 0;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      setQR(qr);
      const now = Date.now();
      if (now - lastQrLog > 60000) {
        lastQrLog = now;
        logger.info('📱 Código QR generado. Escanealo desde el dashboard.');
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const restartRequired = statusCode === DisconnectReason.restartRequired;

      setConnectionStatus('disconnected');
      logger.info(`Conexión cerrada: código ${statusCode} (loggedOut=${loggedOut}, restart=${restartRequired})`);

      if (loggedOut) {
        clearQR();
        logger.warn('Sesión cerrada. Escaneá el QR de nuevo.');
        return;
      }
      if (restartRequired) {
        logger.info('Reconexión requerida por Baileys. Reintentando en 3s...');
        setTimeout(start, 3000);
        return;
      }
      logger.info('Reconectando en 5 segundos...');
      setTimeout(start, 5000);
      return;
    }

    if (connection === 'open') {
      clearQR();
      logger.info('🚀  Agente WhatsApp listo y conectado!');
      setConnectionStatus('connected');

      scheduler = new MessageScheduler(sock);
      scheduler.loadFromConfig();

      const jobs = scheduler.listJobs();
      if (jobs.length > 0) {
        logger.info('Mensajes programados activos:');
        jobs.forEach((j) => logger.info(`  - ${j.name}: ${j.cronExpression} -> ${j.number}`));
      }

      agent.init().catch(err => {
        logger.warn('agent.init() falló (no crítico):', { error: err.message });
      });
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (!msg.key || msg.key.fromMe) continue;
        if (!msg.key.remoteJid) continue;
        if (msg.key.remoteJid.endsWith('@g.us') && config.autoReply.ignoreGroups) continue;

        const from = msg.key.remoteJid;

        let msgContent = msg.message;
        if (msgContent?.ephemeralMessage?.message) {
          msgContent = msgContent.ephemeralMessage.message;
        }

        const messageText = msgContent?.conversation
          || msgContent?.extendedTextMessage?.text
          || msgContent?.imageMessage?.caption
          || msgContent?.videoMessage?.caption
          || '';

        if (!messageText.trim()) continue;

        const name = msg.pushName || from.split('@')[0] || 'Desconocido';

        logger.info(`📩 Mensaje de ${name} (${from}): "${messageText.substring(0, 100)}"`);

        if (!isAIConfigured()) {
          logger.warn('⚠️  OPENAI_API_KEY no configurada.');
          await sock.sendMessage(from, { text: '⚠️ El agente IA no está configurado. Configurá OPENAI_API_KEY en el .env' });
          return;
        }

        const response = await agent.processMessage(messageText, from, name);

        if (response) {
          await sock.sendMessage(from, { text: response }, { quoted: msg });
          conversationLogger.logIncoming(name, from, messageText, response);
          logger.info(`✅ Respuesta enviada a ${name}`);
        }
      } catch (error) {
        logger.error('Error procesando mensaje:', { error: error.message, stack: error.stack });
        conversationLogger.logError(msg?.key?.remoteJid, msg?.message?.conversation, error);
      }
    }
  });

  process.on('SIGINT', async () => {
    logger.info('Apagando agente WhatsApp...');
    if (scheduler) scheduler.stopAll();
    await agent.shutdown();
    sock.end(new Error('Shutdown'));
    process.exit(0);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason, stack: reason?.stack });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
});

logger.info('==========================================');
logger.info('   Iniciando Agente WhatsApp...');
logger.info('==========================================');
if (!isAIConfigured()) {
  logger.warn('⚠️  OPENAI_API_KEY no configurada.');
  logger.warn('   Creá un archivo .env basado en .env.example');
}
logger.info('Esperando código QR...');

start();
