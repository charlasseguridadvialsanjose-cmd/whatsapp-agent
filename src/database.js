import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'turnos.db');

let db;

export function initDB() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area TEXT NOT NULL,
      fecha TEXT NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      cupo_maximo INTEGER NOT NULL DEFAULT 0,
      cupos_usados INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area TEXT NOT NULL,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      fecha_turno TEXT NOT NULL,
      hora_turno TEXT,
      requisitos_cumplidos TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', '-3 hours')),
      notas TEXT
    );

    CREATE TABLE IF NOT EXISTS conversation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefono TEXT NOT NULL,
      nombre TEXT,
      mensaje TEXT,
      respuesta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', '-3 hours'))
    );
  `);

  logger.info('Base de datos inicializada');
  return db;
}

export function getDB() {
  if (!db) throw new Error('DB not initialized. Call initDB() first.');
  return db;
}

export function getConfig(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  if (!row) return defaultValue;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

export function getSchedules() {
  return db.prepare('SELECT * FROM schedules WHERE activo = 1 ORDER BY fecha ASC').all();
}

export function getScheduleForArea(area) {
  return db.prepare('SELECT * FROM schedules WHERE area = ? AND activo = 1 ORDER BY fecha ASC').all(area);
}

export function addSchedule({ area, fecha, hora_inicio, hora_fin, cupo_maximo }) {
  const result = db.prepare(
    'INSERT INTO schedules (area, fecha, hora_inicio, hora_fin, cupo_maximo) VALUES (?, ?, ?, ?, ?)'
  ).run(area, fecha, hora_inicio, hora_fin, cupo_maximo);
  return result.lastInsertRowid;
}

export function deleteSchedule(id) {
  db.prepare('UPDATE schedules SET activo = 0 WHERE id = ?').run(id);
}

export function hasAvailableSlots(area, fecha) {
  const schedules = db.prepare(
    'SELECT * FROM schedules WHERE area = ? AND fecha = ? AND activo = 1'
  ).all(area, fecha);

  if (schedules.length === 0) return false;

  for (const s of schedules) {
    if (s.cupo_maximo === 0) return true;
    if (s.cupos_usados < s.cupo_maximo) return true;
  }
  return false;
}

export function getAvailableDates(area) {
  return db.prepare(
    'SELECT fecha, hora_inicio, hora_fin, cupo_maximo, cupos_usados FROM schedules WHERE area = ? AND activo = 1 AND cupo_maximo > cupos_usados ORDER BY fecha ASC'
  ).all(area);
}

export function bookAppointment({ area, nombre, telefono, fecha_turno, hora_turno, requisitos_cumplidos, notas }) {
  const tx = db.transaction(() => {
    const schedule = db.prepare(
      'SELECT * FROM schedules WHERE area = ? AND fecha = ? AND activo = 1 AND cupo_maximo > cupos_usados LIMIT 1'
    ).get(area, fecha_turno);

    if (!schedule) {
      throw new Error(`No hay cupos disponibles para ${area} el ${fecha_turno}`);
    }

    db.prepare(
      'INSERT INTO appointments (area, nombre, telefono, fecha_turno, hora_turno, requisitos_cumplidos, notas) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(area, nombre, telefono, fecha_turno, hora_turno, requisitos_cumplidos || '', notas || '');

    db.prepare(
      'UPDATE schedules SET cupos_usados = cupos_usados + 1 WHERE id = ?'
    ).run(schedule.id);
  });

  tx();
  return true;
}

export function getAppointments(area = null, fecha = null) {
  let query = 'SELECT * FROM appointments WHERE 1=1';
  const params = [];

  if (area) { query += ' AND area = ?'; params.push(area); }
  if (fecha) { query += ' AND fecha_turno = ?'; params.push(fecha); }

  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params);
}

export function getTodayStats() {
  const hoy = new Date().toISOString().split('T')[0];
  return {
    hoy: db.prepare('SELECT COUNT(*) as total FROM appointments WHERE date(created_at) = ?').get(hoy).total,
    total: db.prepare('SELECT COUNT(*) as total FROM appointments').get().total,
    hcd: db.prepare("SELECT COUNT(*) as total FROM appointments WHERE area = 'HCD'").get().total,
    cic: db.prepare("SELECT COUNT(*) as total FROM appointments WHERE area = 'CIC'").get().total,
    schedulesActivas: db.prepare('SELECT COUNT(*) as total FROM schedules WHERE activo = 1').get().total,
  };
}

export function exportAppointmentsCSV() {
  const rows = db.prepare('SELECT * FROM appointments ORDER BY created_at DESC').all();
  return rows;
}
