import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { stringify } from 'csv-stringify/sync';
import {
  getConfig, setConfig,
  getSchedules, getScheduleForArea, addSchedule, deleteSchedule,
  getAppointments, getTodayStats, exportAppointmentsCSV, hasAvailableSlots, getAvailableDates
} from './database.js';
import { getQR, getQRString, getConnectionStatus } from './state.js';
import logger from './logger.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/stats', (req, res) => {
    res.json(getTodayStats());
  });

  app.get('/api/config', (req, res) => {
    res.json({
      businessRole: getConfig('businessRole', ''),
      businessType: getConfig('businessType', ''),
      keepEmail: getConfig('keepEmail', ''),
      hcdInstructions: getConfig('hcdInstructions', ''),
      cicInstructions: getConfig('cicInstructions', ''),
      appointmentRules: getConfig('appointmentRules', ''),
    });
  });

  app.post('/api/config', (req, res) => {
    const { key, value } = req.body;
    setConfig(key, value);
    res.json({ success: true });
  });

  app.get('/api/schedules', (req, res) => {
    const area = req.query.area;
    if (area) {
      res.json(getScheduleForArea(area));
    } else {
      res.json(getSchedules());
    }
  });

  app.post('/api/schedules', (req, res) => {
    const { area, fecha, hora_inicio, hora_fin, cupo_maximo } = req.body;
    const id = addSchedule({ area, fecha, hora_inicio, hora_fin, cupo_maximo });
    res.json({ success: true, id });
  });

  app.delete('/api/schedules/:id', (req, res) => {
    deleteSchedule(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get('/api/appointments', (req, res) => {
    const { area, fecha } = req.query;
    res.json(getAppointments(area, fecha));
  });

  app.get('/api/appointments/export', (req, res) => {
    const rows = exportAppointmentsCSV();
    const csv = stringify(rows, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="turnos.csv"');
    res.send(csv);
  });

  app.get('/api/availability/:area', (req, res) => {
    const dates = getAvailableDates(req.params.area);
    res.json(dates);
  });

  app.get('/api/qr', (req, res) => {
    const qr = getQR();
    const raw = getQRString();
    res.json({ qr, raw, status: getConnectionStatus() });
  });

  app.get('/api/connection-status', (req, res) => {
    res.json({ status: getConnectionStatus(), hasQR: !!getQR() });
  });

  app.get('/api/logs', (req, res) => {
    const logPath = path.join(__dirname, '..', 'logs', 'combined.log');
    try {
      const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean).slice(-50);
      res.json({ lines });
    } catch (e) {
      res.json({ lines: ['(log no disponible)'] });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return app;
}

export function startServer(port = 3000) {
  const app = createServer();
  app.listen(port, '0.0.0.0', () => {
    logger.info(`🌐 Dashboard web: http://localhost:${port}`);
    logger.info(`📊 API disponible en http://localhost:${port}/api`);
  });
  return app;
}
