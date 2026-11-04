import http from 'node:http';
import { Server } from 'socket.io';

import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

import { registerChatSocket } from './sockets/chatSocket.js';
import { registerCallSocket } from './sockets/callSocket.js';
import { registerOfficeSocket } from './sockets/officeSocket.js';

import { authenticateToken } from './middleware/auth.js';
import { COOKIE_NAME } from './utils/token.js';

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');

    if (separator === -1) continue;

    const key = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

async function main() {
  await connectDb();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket authentication
  io.use(async (socket, next) => {
    try {
      const token = getCookieValue(
        socket.handshake.headers.cookie,
        COOKIE_NAME
      );

      socket.data.user = await authenticateToken(token);

      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });

  // Register Socket.IO features
  registerChatSocket(io);
  registerCallSocket(io);
  registerOfficeSocket(io);

  server.listen(env.PORT, () => {
    logger.info(
      `ProxiSpeak API listening on :${env.PORT} (${env.NODE_ENV})`
    );
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);

    io.close();

    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
