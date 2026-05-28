import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bridgeScript = path.join(__dirname, 'keep_bridge.py');
const sessionFile = path.join(__dirname, '..', 'sessions', 'keep_session.json');

class KeepClient {
  constructor() {
    this.process = null;
    this.pending = [];
    this.buffer = '';
    this.initialized = false;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.process = spawn('python', ['-u', bridgeScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      });

      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response = JSON.parse(line);
            const resolver = this.pending.shift();
            if (resolver) resolver(response);
          } catch (e) {
            logger.error('Error parseando respuesta de Keep bridge:', { line, error: e.message });
          }
        }
      });

      this.process.stderr.on('data', (data) => {
        logger.warn('Keep bridge stderr:', { message: data.toString().trim() });
      });

      this.process.on('error', (err) => {
        logger.error('Error en proceso Keep bridge:', { error: err.message });
        this.initialized = false;
        reject(err);
      });

      this.process.on('exit', (code) => {
        logger.info(`Keep bridge terminado (código: ${code})`);
        this.initialized = false;
        this.process = null;
      });

      this.initialized = true;
      resolve();
    });
  }

  async send(request) {
    if (!this.process || !this.initialized) {
      throw new Error('Keep bridge no está iniciado');
    }

    return new Promise((resolve) => {
      this.pending.push(resolve);
      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async login(email, password) {
    const result = await this.send({ command: 'login', email, password });
    return result;
  }

  async listNotes(query = null) {
    const result = await this.send({ command: 'list', query });
    return result;
  }

  async getNote(noteId) {
    const result = await this.send({ command: 'get', note_id: noteId });
    return result;
  }

  async searchNotes(query) {
    const result = await this.send({ command: 'search', query });
    return result;
  }

  async listLabels() {
    const result = await this.send({ command: 'list_labels' });
    return result;
  }

  async close() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.initialized = false;
    }
  }

  isAuthenticated() {
    return this.initialized && this.process !== null;
  }
}

export default KeepClient;
