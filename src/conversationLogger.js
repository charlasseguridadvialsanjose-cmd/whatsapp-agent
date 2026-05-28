import fs from 'fs';
import path from 'path';
import config from './config.js';
import logger from './logger.js';

class ConversationLogger {
  constructor() {
    this.storagePath = config.conversations.storagePath;
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  log(entry) {
    const data = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    try {
      fs.appendFileSync(this.storagePath, JSON.stringify(data) + '\n');
    } catch (error) {
      logger.error('Error escribiendo conversación:', { error: error.message });
    }
  }

  logIncoming(from, name, message, response) {
    this.log({
      type: 'incoming',
      from,
      name,
      message,
      response,
    });
  }

  logOutgoing(to, message, type = 'manual') {
    this.log({
      type: 'outgoing',
      to,
      message,
      messageType: type,
    });
  }

  logError(from, message, error) {
    this.log({
      type: 'error',
      from,
      originalMessage: message,
      error: error.message,
    });
  }
}

export default ConversationLogger;
