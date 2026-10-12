import type { CapacitorConfig } from '@capacitor/cli';

// The app is a realtime Socket.IO client (frontend/src/services/socket.ts connects
// same-origin, frontend/src/services/api.ts fetches relative "/api/..." paths). Rather
// than bundling a local build and fighting CORS/websocket-origin issues, the APK points
// its WebView straight at the deployed single-origin server (frontend + backend served
// together — see ../Dockerfile) so it behaves exactly like the browser build, and every
// UI fix you deploy reaches installed apps without a new APK.
const SERVER_URL = process.env.CAPACITOR_SERVER_URL;
if (!SERVER_URL) {
  // Fail here instead of silently building an APK that loads a placeholder address.
  throw new Error('Set CAPACITOR_SERVER_URL to your deployed Uno server, e.g. https://your-app.onrender.com');
}

const config: CapacitorConfig = {
  appId: 'com.uno.realtime',
  appName: 'Uno',
  webDir: 'dist',
  backgroundColor: '#101716',
  server: {
    url: SERVER_URL,
    cleartext: SERVER_URL.startsWith('http://'),
    // Local page (written by native/prepare-offline.mjs) shown when the server can't be reached.
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
