import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'geojson',
      transform(src, id) {
        if (id.endsWith('.geojson')) {
          return { code: `export default ${src}`, map: null };
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: `http://localhost:5001`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});