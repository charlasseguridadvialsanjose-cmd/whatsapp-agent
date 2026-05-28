import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bridgeScript = path.join(__dirname, 'keep_bridge.py');
const sessionFile = path.join(__dirname, '..', 'sessions', 'keep_session.json');
const PYTHON = os.platform() === 'win32' ? 'python' : 'python3';
const OPERATION_TIMEOUT = 15000;

class KeepClient {
  constructor() {
    this.process = null;
    this.pending = [];
    this.buffer = '';
    this.initialized = false;
  }

  start() {
    return new Promise((resolve, reject) => {
      let started = false;
      this.process = spawn(PYTHON, ['-u', bridgeScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      });

      const timeout = setTimeout(() => {
        if (!started) {
          this.process.kill();
          this.process = null;
          reject(new Error(`Timeout iniciando ${PYTHON}`));
        }
      }, 5000);

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
        clearTimeout(timeout);
        logger.error(`Error en proceso Keep bridge (${PYTHON}):`, { error: err.message });
        this.initialized = false;
        this.process = null;
        if (!started) reject(err);
      });

      this.process.on('exit', (code) => {
        clearTimeout(timeout);
        logger.info(`Keep bridge terminado (código: ${code})`);
        this.initialized = false;
        this.process = null;
      });

      started = true;
      clearTimeout(timeout);
      this.initialized = true;
      resolve();
    });
  }

  async send(request) {
    if (!this.process || !this.initialized) {
      throw new Error('Keep bridge no está iniciado');
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        const idx = this.pending.indexOf(resolve);
        if (idx !== -1) this.pending.splice(idx, 1);
        resolve({ success: false, error: 'Timeout' });
      }, OPERATION_TIMEOUT);

      const wrapped = (result) => {
        clearTimeout(timeout);
        resolve(result);
      };

      this.pending.push(wrapped);
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
