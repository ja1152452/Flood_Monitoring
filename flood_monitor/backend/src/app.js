import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import { query } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes          from './modules/auth/auth.routes.js';
import readingsRoutes      from './modules/readings/readings.routes.js';
import alertsRoutes        from './modules/alerts/alerts.routes.js';
import evacuationRoutes    from './modules/evacuation/evacuation.routes.js';
import sosRoutes           from './modules/sos/sos.routes.js';
import usersRoutes         from './modules/users/users.routes.js';
import analyticsRoutes     from './modules/analytics/analytics.routes.js';
import camerasRoutes       from './modules/cameras/cameras.routes.js';
import announcementsRoutes from './modules/announcements/announcements.routes.js';
import barangaysRoutes     from './modules/barangays/barangays.routes.js';
import contactsRoutes      from './modules/contacts/contacts.routes.js';
import riskRoutes          from './modules/risk/risk.routes.js';
import weatherRoutes from './modules/weather/weather.routes.js';
import streamRoutes  from './modules/cameras/stream.routes.js';

const app = express();

app.set('trust proxy', 1);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || origin.endsWith('.trycloudflare.com') || origin.endsWith('.ngrok.io') || origin.endsWith('.ngrok-free.app')) {
      return callback(null, true);
    }
    const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map(o => o.trim());
    if (allowed.includes('*') || allowed.includes(origin) || allowed.includes('null')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Internal-Key'],
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/readings',      readingsRoutes);
app.use('/api/v1/alerts',        alertsRoutes);
app.use('/api/v1/evacuation',    evacuationRoutes);
app.use('/api/v1/sos',           sosRoutes);
app.use('/api/v1/users',         usersRoutes);
app.use('/api/v1/analytics',     analyticsRoutes);
app.use('/api/v1/cameras',       camerasRoutes);
app.use('/api/v1/announcements', announcementsRoutes);
app.use('/api/v1/barangays',     barangaysRoutes);
app.use('/api/v1/contacts',      contactsRoutes);
app.use('/api/v1/risk-areas', riskRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/stream', streamRoutes);
app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      status:   'ok',
      db:       'connected',
      ts:       new Date().toISOString(),
      version:  '1.0.0',
      system:   'Lumban Flood Monitor',
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: err.message,
    });
  }
});

app.use(errorHandler);

export default app;