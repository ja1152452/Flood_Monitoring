import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;
const BACKEND_URL = (process.env.VITE_API_URL || process.env.BACKEND_URL || 'https://flood-monitoring.up.railway.app').replace(/\/$/, '');

// Proxy /api -> ${BACKEND_URL}/api
app.use(
  '/api',
  createProxyMiddleware({
    target: `${BACKEND_URL}/api`,
    changeOrigin: true,
    ws: true,
  })
);

// Proxy /socket.io -> ${BACKEND_URL}/socket.io
app.use(
  '/socket.io',
  createProxyMiddleware({
    target: `${BACKEND_URL}/socket.io`,
    changeOrigin: true,
    ws: true,
  })
);

// Proxy /uploads -> ${BACKEND_URL}/uploads
app.use(
  '/uploads',
  createProxyMiddleware({
    target: `${BACKEND_URL}/uploads`,
    changeOrigin: true,
  })
);

// Serve static frontend assets from dist folder
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback for React Router (handles /login, /dashboard, /rescue, etc.)
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Frontend] Server running on port ${PORT}`);
  console.log(`[Frontend] Proxying to ${BACKEND_URL}`);
});
