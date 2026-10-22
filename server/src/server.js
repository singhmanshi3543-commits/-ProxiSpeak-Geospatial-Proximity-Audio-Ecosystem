import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import setupRedisAdapter from './services/redisAdapter.js';
import initializeSocketHandlers from './socket/socketHandler.js';
import auditRoutes from './routes/auditRoutes.js';
import roomRoutes, { seedDefaultRoomLayout } from './routes/roomRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// API Routes
app.use('/api/audit', auditRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);

// Root health & metadata
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'ProxiSpeak - Geospatial Proximity Audio Ecosystem',
    organization: 'Infotact Solutions',
    timestamp: new Date().toISOString(),
  });
});

// Create HTTP and Socket.IO server
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

async function startServer() {
  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Seed Default Office Layout & Obstacles into MongoDB
    await seedDefaultRoomLayout();

    // 3. Setup Redis Pub/Sub adapter (or fallback to high-perf memory adapter)
    await setupRedisAdapter(io);

    // 4. Initialize Socket.IO Proximity & WebRTC Handlers
    const signalingManager = initializeSocketHandlers(io);

    // 5. Start listening
    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 ProxiSpeak Geospatial Server running on port ${PORT}`);
      console.log(`📍 MongoDB 2D $near & $geoWithin Proximity Engine Active`);
      console.log(`🎙️ WebRTC Mesh Signaling restricted to 100px earshot`);
      console.log(`🏢 Infotact Digital HQ Map initialized`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Fatal server startup error:', error);
    process.exit(1);
  }
}

startServer();

export { app, server, io };
