// Writes dist/offline.html with the real server URL baked in, so the Retry button on the
// Android error page knows where to go (that page can't reach Capacitor config or plugins).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = join(dirname(fileURLToPath(import.meta.url)), '..');

let serverUrl;
try {
  serverUrl = new URL(process.env.CAPACITOR_SERVER_URL ?? '').href;
} catch {
  console.error(
    'CAPACITOR_SERVER_URL must be a full URL, e.g. https://your-app.onrender.com',
  );
  process.exit(1);
}

const template = readFileSync(join(frontendDir, 'native', 'offline.html'), 'utf8');
// Quote-agnostic so a formatter switching ' and " can't silently break the injection.
const placeholder = /(["'])__SERVER_URL__\1/;
if (!placeholder.test(template)) {
  console.error('native/offline.html has no __SERVER_URL__ placeholder to replace');
  process.exit(1);
}
// "<" is escaped so a URL can never close the inline <script>.
const literal = JSON.stringify(serverUrl).replace(/</g, '\\u003c');

mkdirSync(join(frontendDir, 'dist'), { recursive: true });
writeFileSync(
  join(frontendDir, 'dist', 'offline.html'),
  template.replace(placeholder, () => literal),
);
