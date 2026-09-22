import type { CapacitorConfig } from '@capacitor/cli';

// The app is a realtime Socket.IO client (frontend/src/services/socket.ts connects
// same-origin, frontend/src/services/api.ts fetches relative "/api/..." paths). Rather
// than bundling a local build and fighting CORS/websocket-origin issues, the APK points
// its WebView straight at the deployed single-origin server (frontend + backend served
// together — see ../Dockerfile) so it behaves exactly like the browser build.
// Set this to your real deployed URL before running `npx cap sync`.
const SERVER_URL = process.env.CAPACITOR_SERVER_URL || 'https://REPLACE-WITH-YOUR-RENDER-URL.onrender.com';

const config: CapacitorConfig = {
  appId: 'com.uno.realtime',
  appName: 'Uno',
  webDir: 'dist',
  server: {
    url: SERVER_URL,
    cleartext: SERVER_URL.startsWith('http://'),
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
