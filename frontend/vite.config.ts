import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // @uno/shared is a CommonJS build resolved through an npm-workspace symlink
    // (node_modules/@uno/shared -> ../shared), which lands outside Rollup's
    // default commonjs-interop include pattern (node_modules/**) — widen it.
    commonjsOptions: { include: [/node_modules/, /shared\/dist/] },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_SERVER_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_SERVER_URL || 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
