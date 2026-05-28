import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import pino from 'pino';
import config from './config.js';
import logger from './logger.js';
import { isAIConfigured } from './ai.js';
import MessageScheduler from './scheduler.js';
import ConversationLogger from './conversationLogger.js';
import Agent from './agent.js';
import { initDB } from './database.js';
import { startServer } from './server.js';
import { setQR, setConnectionStatus } from './state.js';

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
  });

  sock.ev.on('creds.update', saveCreds);

  let qrDisplayed = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !qrDisplayed) {
      qrDisplayed = true;
      logger.info('📱 Código QR generado. Escanealo desde el dashboard.');
      qrcode.toDataURL(qr, { width: 400, margin: 2 }, (err, url) => {
        if (!err) setQR(url, qr);
      });
      setTimeout(() => { qrDisplayed = false; }, 120000);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const restartRequired = statusCode === DisconnectReason.restartRequired;

      setConnectionStatus('disconnected');
      logger.info(`Conexión cerrada: código ${statusCode} (loggedOut=${loggedOut}, restart=${restartRequired})`);

      if (loggedOut) {
        logger.warn('Sesión cerrada. Escaneá el QR de nuevo.');
        return;
      }
      if (restartRequired) {
        logger.info('Reconexión requerida por Baileys. Reintentando...');
        setTimeout(start, 1000);
        return;
      }
      logger.info('Reconectando en 5 segundos...');
      setTimeout(start, 5000);
    }

    if (connection === 'open') {
      logger.info('🚀  Agente WhatsApp listo y conectado!');
      setConnectionStatus('connected');
      qrDisplayed = false;

      scheduler = new MessageScheduler(sock);
      scheduler.loadFromConfig();

      const jobs = scheduler.listJobs();
      if (jobs.length > 0) {
        logger.info('Mensajes programados activos:');
        jobs.forEach((j) => logger.info(`  - ${j.name}: ${j.cronExpression} -> ${j.number}`));
      }

      await agent.init();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid.endsWith('@g.us') && config.autoReply.ignoreGroups) continue;

        const from = msg.key.remoteJid;
        const messageText = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
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
        logger.error('Error procesando mensaje:', { error: error.message });
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

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason });
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
