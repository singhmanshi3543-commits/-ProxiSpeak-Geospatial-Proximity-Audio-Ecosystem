import GeospatialEngine from './geospatialEngine.js';
import UserLocation from '../models/UserLocation.js';

export class SignalingManager {
  constructor(io) {
    this.io = io;
    
    this.socketToUserMap = new Map();
  
    this.userToSocketMap = new Map();
   
    this.earshotMap = new Map();
  }

  registerUser(socket, user) {
    this.socketToUserMap.set(socket.id, user.userId);
    this.userToSocketMap.set(user.userId, socket.id);
    if (!this.earshotMap.has(user.userId)) {
      this.earshotMap.set(user.userId, new Set());
    }
  }

  unregisterUser(socketId) {
    const userId = this.socketToUserMap.get(socketId);
    if (!userId) return null;

    this.socketToUserMap.delete(socketId);
    this.userToSocketMap.delete(userId);
    const peersInEarshot = this.earshotMap.get(userId) || new Set();
    this.earshotMap.delete(userId);

    peersInEarshot.forEach((peerId) => {
      const peerSocketId = this.userToSocketMap.get(peerId);
      if (peerSocketId) {
        this.io.to(peerSocketId).emit('peer-left-earshot', {
          peerId: userId,
          reason: 'disconnected',
        });
      }
      const peerEarshotSet = this.earshotMap.get(peerId);
      if (peerEarshotSet) {
        peerEarshotSet.delete(userId);
      }
    });

    return userId;
  }

  getSocketId(userId) {
    return this.userToSocketMap.get(userId);
  }

  getUserId(socketId) {
    return this.socketToUserMap.get(socketId);
  }

  isPeerInEarshot(userId1, userId2) {
    const user1Set = this.earshotMap.get(userId1);
    return user1Set ? user1Set.has(userId2) : false;
  }

  async handleUserMovement(userId, coordinates, facingAngle = 0, isSpeaking = false) {
    const socketId = this.userToSocketMap.get(userId);
    if (!socketId) return null;

    // 1. Update location in MongoDB
    await UserLocation.findOneAndUpdate(
      { userId },
      {
        coordinates,
        facingAngle,
        isSpeaking,
        lastMovedAt: new Date(),
      },
      { upsert: false }
    );

    // 2. Query MongoDB $near for peers within 100-pixel earshot
    const { users: currentPeersInEarshot, latencyMs } = await GeospatialEngine.findUsersInEarshot(
      userId,
      coordinates,
      100 // 100px earshot threshold
    );

    const currentPeerIds = new Set(currentPeersInEarshot.map((u) => u.userId));
    const previousPeerIds = this.earshotMap.get(userId) || new Set();

    // 3. Compute sets: entered earshot vs left earshot
    const enteredPeers = currentPeersInEarshot.filter((u) => !previousPeerIds.has(u.userId));
    const leftPeerIds = [...previousPeerIds].filter((id) => !currentPeerIds.has(id));

    // 4. Update the stored earshot state
    this.earshotMap.set(userId, currentPeerIds);

    // 5. Notify peers who entered earshot to initiate WebRTC P2P connection handshake
    for (const peer of enteredPeers) {
      const peerSocketId = this.userToSocketMap.get(peer.userId);
      if (peerSocketId) {
        // Deterministic handshake initiator: lexicographically smaller userId acts as polite initiator
        const shouldInitiateOffer = userId < peer.userId;

        // Notify user about entering peer
        this.io.to(socketId).emit('peer-entered-earshot', {
          peer: {
            userId: peer.userId,
            username: peer.username,
            avatarColor: peer.avatarColor,
            coordinates: peer.coordinates,
            distance: peer.distance,
            normalizedGain: peer.normalizedGain,
            relativeVector: peer.relativeVector,
          },
          shouldInitiateOffer,
        });

        // Notify peer about user
        this.io.to(peerSocketId).emit('peer-entered-earshot', {
          peer: {
            userId,
            distance: peer.distance,
            normalizedGain: peer.normalizedGain,
            relativeVector: { dx: -peer.relativeVector.dx, dy: -peer.relativeVector.dy },
          },
          shouldInitiateOffer: !shouldInitiateOffer,
        });

        // Track symmetrical earshot
        const peerSet = this.earshotMap.get(peer.userId);
        if (peerSet) peerSet.add(userId);
      }
    }

    // 6. Notify peers who left earshot to tear down WebRTC audio track
    for (const leftPeerId of leftPeerIds) {
      // Notify current user
      this.io.to(socketId).emit('peer-left-earshot', {
        peerId: leftPeerId,
        reason: 'out_of_range',
      });

      // Notify remote peer
      const peerSocketId = this.userToSocketMap.get(leftPeerId);
      if (peerSocketId) {
        this.io.to(peerSocketId).emit('peer-left-earshot', {
          peerId: userId,
          reason: 'out_of_range',
        });
        const peerSet = this.earshotMap.get(leftPeerId);
        if (peerSet) peerSet.delete(userId);
      }
    }

    // 7. Send real-time distance and gain updates to peers currently in earshot
    for (const peer of currentPeersInEarshot) {
      const peerSocketId = this.userToSocketMap.get(peer.userId);
      if (peerSocketId) {
        this.io.to(peerSocketId).emit('peer-distance-update', {
          peerId: userId,
          coordinates,
          distance: peer.distance,
          normalizedGain: peer.normalizedGain,
          relativeVector: { dx: -peer.relativeVector.dx, dy: -peer.relativeVector.dy },
        });
      }
    }

    return {
      peersInEarshot: currentPeersInEarshot,
      queryLatencyMs: latencyMs,
    };
  }

  /**
   * Relay WebRTC Offer to target peer (only allowed if peers are in earshot)
   */
  handleWebRTCOffer(fromUserId, { targetUserId, sdp }) {
    const targetSocketId = this.userToSocketMap.get(targetUserId);
    if (!targetSocketId) {
      console.warn(`[Signaling] Cannot send offer: target ${targetUserId} not online.`);
      return;
    }

    // Proximity check: only send WebRTC offer/answers to users within 100px radius
    if (!this.isPeerInEarshot(fromUserId, targetUserId)) {
      console.warn(`[Signaling] Blocked WebRTC offer: ${fromUserId} and ${targetUserId} not in earshot.`);
      return;
    }

    this.io.to(targetSocketId).emit('webrtc-offer', {
      fromUserId,
      sdp,
    });
  }

  /**
   * Relay WebRTC Answer to target peer
   */
  handleWebRTCAnswer(fromUserId, { targetUserId, sdp }) {
    const targetSocketId = this.userToSocketMap.get(targetUserId);
    if (!targetSocketId) return;

    this.io.to(targetSocketId).emit('webrtc-answer', {
      fromUserId,
      sdp,
    });
  }

  /**
   * Relay ICE Candidate to target peer
   */
  handleIceCandidate(fromUserId, { targetUserId, candidate }) {
    const targetSocketId = this.userToSocketMap.get(targetUserId);
    if (!targetSocketId) return;

    this.io.to(targetSocketId).emit('webrtc-ice-candidate', {
      fromUserId,
      candidate,
    });
  }
}

export default SignalingManager;
