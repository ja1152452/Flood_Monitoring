import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;
const BACKEND_URL = (process.env.VITE_API_URL || process.env.BACKEND_URL || 'https://flood-monitoring.up.railway.app').replace(/\/$/, '');

// Proxy API and socket requests to backend while preserving full paths
if (BACKEND_URL) {
  app.use(
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      ws: true,
      filter: (pathname) =>
        pathname.startsWith('/api') ||
        pathname.startsWith('/socket.io') ||
        pathname.startsWith('/uploads'),
    })
  );
}

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA client-side routing (React Router fallback)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Frontend] Server running on port ${PORT}`);
  console.log(`[Frontend] Proxying API & Sockets to ${BACKEND_URL}`);
});
