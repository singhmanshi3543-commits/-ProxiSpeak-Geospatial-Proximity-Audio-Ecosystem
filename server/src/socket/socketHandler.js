import UserLocation from '../models/UserLocation.js';
import SignalingManager from '../services/signalingManager.js';
import GeospatialEngine from '../services/geospatialEngine.js';

export function initializeSocketHandlers(io) {
  const signalingManager = new SignalingManager(io);

  io.on('connection', (socket) => {
    socket.on('join-world', async (userData, callback) => {
      try {
        if(!userData || typeof userData !== 'object' || Array.isArray(userData)){
          if(typeof callback === 'function'){
            callback({
              status: 'error',
              message: 'Invalid user data',
            });
          }
          return;
        }
        const {
          userId,
          username,
          role = 'Engineer',
          avatarColor = '#3b82f6',
          initialCoordinates = [400, 300],
        } = userData;

        const [x, y] = initialCoordinates;

        const userDoc = await UserLocation.findOneAndUpdate(
          { userId },
          {
            userId,
            socketId: socket.id,
            username,
            role,
            avatarColor,
            coordinates: [x, y],
            isSpeaking: false,
            isMuted: false,
            isDeafened: false,
            isBot: false,
            lastMovedAt: new Date(),
          },
          { upsert: true, new: true }
        );

        signalingManager.registerUser(socket, { userId, socketId: socket.id });

        const allActiveUsers = await UserLocation.find({
          userId: { $ne: userId },
        })
          .select('userId username role avatarColor coordinates isSpeaking isMuted isDeafened currentRoom isBot')
          .lean();

        const { users: initialPeersInEarshot, latencyMs } = await GeospatialEngine.findUsersInEarshot(
          userId,
          [x, y],
          100
        );

        socket.broadcast.emit('peer-joined-world', {
          userId,
          username,
          role,
          avatarColor,
          coordinates: [x, y],
          isSpeaking: false,
          isMuted: false,
          isDeafened: false,
          isBot: false,
        });

        for (const peer of initialPeersInEarshot) {
          const peerSocketId = signalingManager.getSocketId(peer.userId);
          const shouldInitiateOffer = userId < peer.userId;

          socket.emit('peer-entered-earshot', {
            peer,
            shouldInitiateOffer,
          });

          if (peerSocketId) {
            io.to(peerSocketId).emit('peer-entered-earshot', {
              peer: {
                userId,
                username,
                avatarColor,
                coordinates: [x, y],
                distance: peer.distance,
                normalizedGain: peer.normalizedGain,
                relativeVector: { dx: -peer.relativeVector.dx, dy: -peer.relativeVector.dy },
              },
              shouldInitiateOffer: !shouldInitiateOffer,
            });
          }
        }

        if (typeof callback === 'function') {
          callback({
            status: 'success',
            user: userDoc,
            allActiveUsers,
            peersInEarshot: initialPeersInEarshot,
            initialQueryLatencyMs: latencyMs,
          });
        }
      } catch (err) {
        console.error('[Socket] join-world error:', err);
        if (typeof callback === 'function') {
          callback({ status: 'error', message: err.message });
        }
      }
    });

    socket.on('avatar-move', async (data = {}) => {
      try {
        if(!data || typeof data !== 'object' || Array.isArray(data)) return;
        const { 
          coordinates, 
          facingAngle = 0, 
          isSpeaking = false 
        } = data;
        const userId = signalingManager.getUserId(socket.id);
        if (
          !userId ||
          !Array.isArray(coordinates) ||
          coordinates.length !== 2 ||
          !coordinates.every(value=> typeof value === 'number' && Number.isFinite(value)) || 
          typeof facingAngle !== 'number' ||
          !Number.isFinite(facingAngle) || 
          facingAngle< -360 || 
          facingAngle> 360 ||
          typeof isSpeaking !== 'boolean'
        ){
          return;
        }

        if(!socket.connected) return;

        await signalingManager.handleUserMovement(userId, coordinates, facingAngle, isSpeaking);

        socket.broadcast.emit('peer-moved', {
          userId,
          coordinates,
          facingAngle,
          isSpeaking,
        });
      } catch (err) {
        console.error('[Socket] avatar-move error:', err);
      }
    });

    socket.on('voice-status-change', async (data) => {
      try {
        const { userId, isSpeaking, isMuted, isDeafened } = data;
        if (!userId) return;

        await UserLocation.updateOne(
          { userId },
          {
            $set: {
              ...(isSpeaking !== undefined && { isSpeaking }),
              ...(isMuted !== undefined && { isMuted }),
              ...(isDeafened !== undefined && { isDeafened }),
            },
          }
        );

        socket.broadcast.emit('peer-voice-status-changed', {
          userId,
          isSpeaking,
          isMuted,
          isDeafened,
        });
      } catch (err) {
        console.error('[Socket] voice-status-change error:', err);
      }
    });

    socket.on('webrtc-offer', (payload) => {
      const fromUserId = signalingManager.getUserId(socket.id);
      if (fromUserId) {
        signalingManager.handleWebRTCOffer(fromUserId, payload);
      }
    });

    socket.on('webrtc-answer', (payload) => {
      const fromUserId = signalingManager.getUserId(socket.id);
      if (fromUserId) {
        signalingManager.handleWebRTCAnswer(fromUserId, payload);
      }
    });

    socket.on('webrtc-ice-candidate', (payload) => {
      const fromUserId = signalingManager.getUserId(socket.id);
      if (fromUserId) {
        signalingManager.handleIceCandidate(fromUserId, payload);
      }
    });

    socket.on('batch-bot-update', async (bots) => {
      if (!Array.isArray(bots)) return;
      socket.broadcast.emit('peers-batch-moved', bots);
    });

    socket.on('disconnect', async () => {
      try {
        const userId = signalingManager.unregisterUser(socket.id);
        if (userId) {
          await UserLocation.deleteOne({ userId });
          socket.broadcast.emit('peer-left-world', { userId });
        }
      } catch (err) {
        console.error('[Socket] disconnect error:', err);
      }
    });
  });

  return signalingManager;
}

export default initializeSocketHandlers;
