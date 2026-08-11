import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { testConnection, query } from './config/db.js';
import { startHLS } from './services/stream/hls.service.js';
import { setIO } from './config/socket.js';

const PORT = parseInt(process.env.PORT || '5000');

const server = http.createServer(app);

export const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

setIO(io);

// Authenticate socket connection via JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.sub;
    socket.userRole = payload.role;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'MDRRMO', 'BARANGAY_OFFICIAL', 'RESCUE'];

io.on('connection', (socket) => {
  // Admins join a room to receive location updates
  if (ADMIN_ROLES.includes(socket.userRole)) {
    socket.join('admins');
  }

  // Responder sends their location
  socket.on('responder:location', async ({ lat, lng }) => {
    if (!RESPONDER_ROLES.includes(socket.userRole)) return;
    if (!lat || !lng) return;

    try {
      // Persist to DB
      await query(
        `UPDATE users SET last_lat = $2, last_lng = $3, last_location_at = NOW() WHERE id = $1`,
        [socket.userId, lat, lng]
      );

      // Fetch full name and role to broadcast
      const { rows } = await query(
        `SELECT id, full_name, role, last_lat, last_lng, last_location_at FROM users WHERE id = $1`,
        [socket.userId]
      );
      if (rows.length) {
        io.to('admins').emit('responder:location', rows[0]);
      }
    } catch (_) {}
  });

  socket.on('disconnect', () => {
    // Notify admins this responder went offline
    if (RESPONDER_ROLES.includes(socket.userRole)) {
      io.to('admins').emit('responder:offline', { id: socket.userId });
    }
  });
});

const start = async () => {
  await testConnection();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[API] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[API] Connect from phones: http://192.168.1.20:${PORT}`);
    console.log(`[API] Health check: http://localhost:${PORT}/health`);
    if (process.env.ENABLE_LOCAL_HLS === 'true') {
      startHLS();
    } else {
      console.log('[HLS] Local HLS disabled — RTSP port available for YouTube stream');
    }
  });
};

start().catch(err => {
  console.error('[Startup] Fatal error:', err.message);
  process.exit(1);
});
