import UserLocation from '../models/UserLocation.js';
import SignalingManager from '../services/signalingManager.js';
import GeospatialEngine from '../services/geospatialEngine.js';

export function initializeSocketHandlers(io) {
  const signalingManager = new SignalingManager(io);

  io.on('connection', (socket) => {
    // 1. User joins the virtual world
    socket.on('join-world', async (userData, callback) => {
      try {
        const {
          userId,
          username,
          role = 'Engineer',
          avatarColor = '#3b82f6',
          initialCoordinates = [400, 300],
        } = userData;

        const [x, y] = initialCoordinates;

        // Upsert user in MongoDB
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

        // Retrieve all other active users in the room
        const allActiveUsers = await UserLocation.find({
          userId: { $ne: userId },
        })
          .select('userId username role avatarColor coordinates isSpeaking isMuted isDeafened currentRoom isBot')
          .lean();

        // Calculate initial earshot proximity
        const { users: initialPeersInEarshot, latencyMs } = await GeospatialEngine.findUsersInEarshot(
          userId,
          [x, y],
          100
        );

        // Notify other users that a new peer entered the office
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

        // Trigger earshot events for users initially close to this user
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

    // 2. Avatar Movement (broadcast coordinates & recalculate proximity)
    socket.on('avatar-move', async (data) => {
      try {
        const { userId, coordinates, facingAngle = 0, isSpeaking = false } = data;
        if (!userId || !coordinates) return;

        // Broadcast immediate position to all clients for smooth 60 FPS rendering
        socket.broadcast.emit('peer-moved', {
          userId,
          coordinates,
          facingAngle,
          isSpeaking,
        });

        // Backend evaluates MongoDB $near proximity calculations and triggers WebRTC handshakes
        await signalingManager.handleUserMovement(userId, coordinates, facingAngle, isSpeaking);
      } catch (err) {
        console.error('[Socket] avatar-move error:', err);
      }
    });

    // 3. Audio status change (mute / deafen / speaking state)
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

    // 4. WebRTC Signaling Relays (Restricted to earshot peers)
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

    // 5. Bot Swarm movement batch updates
    socket.on('batch-bot-update', async (bots) => {
      if (!Array.isArray(bots)) return;
      socket.broadcast.emit('peers-batch-moved', bots);
    });

    // 6. Disconnect
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
