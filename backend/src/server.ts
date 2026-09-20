import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import cors from 'cors';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { connectMongo } from './db';
import { healthRouter } from './routes/health';
import { roomsRouter } from './routes/rooms';
import { usersRouter } from './routes/users';
import { registerSocketHandlers } from './sockets';

export function createApp(): { app: Express; httpServer: HttpServer; io: SocketIOServer } {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: config.nodeEnv === 'production' ? undefined : { origin: config.corsOrigin },
  });

  if (config.nodeEnv !== 'production') {
    app.use(cors({ origin: config.corsOrigin }));
  }
  app.use(express.json());
  app.use('/api', healthRouter);
  app.use('/api', roomsRouter);
  app.use('/api', usersRouter);

  // Single-container deployment: serve the built frontend when present
  // (Dockerfile copies frontend/dist into backend/public — plan.md Deployment Plan).
  const staticDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  registerSocketHandlers(io);

  return { app, httpServer, io };
}

function main(): void {
  const { httpServer } = createApp();
  // Listen immediately so /api/health (and the static frontend) respond even
  // while MongoDB is still connecting — this is what makes the frontend's
  // "waking up the server" cold-start check work reliably. DB-backed routes
  // will simply wait on Mongoose's command buffer until the connection is up.
  httpServer.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Uno backend listening on :${config.port}`);
  });

  // Deliberately not awaited/fatal: a slow or momentarily-unreachable MongoDB
  // (e.g. Atlas cold-starting alongside Render) must not crash a process
  // that's otherwise healthy. Mongoose keeps retrying in the background;
  // DB-backed routes simply wait until it connects.
  connectMongo()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Connected to MongoDB');
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Initial MongoDB connection attempt failed, will keep retrying:', err.message);
    });
}

if (require.main === module) {
  main();
}
