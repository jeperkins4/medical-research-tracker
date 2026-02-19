import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron compatibility
  server: {
    host: '0.0.0.0', // Allow network access
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Proxy to backend on same machine
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
