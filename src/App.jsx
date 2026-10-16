import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import VirtualOfficeCanvas from './components/VirtualOfficeCanvas.jsx';
import HeaderNav from './components/HeaderNav.jsx';
import AudioControlsBar from './components/AudioControlsBar.jsx';
import ProximityRadar from './components/ProximityRadar.jsx';
import SpatialBenchmarkModal from './components/SpatialBenchmarkModal.jsx';
import AudioGuideModal from './components/AudioGuideModal.jsx';
import UserProfileModal from './components/UserProfileModal.jsx';
import BotSwarmController from './components/BotSwarmController.jsx';
import QuickStartGuide from './components/QuickStartGuide.jsx';
import spatialMixerInstance from './audio/SpatialAudioMixer.js';
import WebRTCManager from './audio/WebRTCManager.js';
import AudioSynthesizerDemo from './audio/AudioSynthesizerDemo.js';

function generateInitialUser() {
  const randomId = Math.random().toString(36).substring(2, 9);
  const colors = ['#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];
  const chosenColor = colors[Math.floor(Math.random() * colors.length)];
  const adjectives = ['Quantum', 'Apex', 'Cyber', 'Swift', 'Hyper', 'Nova', 'Vector', 'Pixel'];
  const roles = ['Lead Architect', 'Spatial Audio Eng', 'Full-Stack Lead', 'AI Specialist', 'Systems Eng'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const role = roles[Math.floor(Math.random() * roles.length)];

  return {
    userId: `user-${randomId}`,
    username: `${adj} Colleague`,
    role,
    avatarColor: chosenColor,
    coordinates: [850, 240],
    facingAngle: 0,
    isMuted: false,
    isDeafened: false,
  };
}

export function App() {
  const [localUser, setLocalUser] = useState(generateInitialUser);
  const [remotePeers, setRemotePeers] = useState([]);
  const [peersInEarshot, setPeersInEarshot] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentZone, setCurrentZone] = useState('Engineering Hub');
  const [fps, setFps] = useState(60);
  const [latencyMs, setLatencyMs] = useState(3.2);

  const [masterVolume, setMasterVolume] = useState(1.0);
  const [enable3DPanning, setEnable3DPanning] = useState(true);
  const [enableOcclusion, setEnableOcclusion] = useState(true);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [syntheticChatterEnabled, setSyntheticChatterEnabled] = useState(true);

  const [micVolume, setMicVolume] = useState(0);
  const [micStatus, setMicStatus] = useState('requesting');
  const [isLoopbackActive, setIsLoopbackActive] = useState(false);
  const [audioEngineState, setAudioEngineState] = useState('running');
  const [findMeTrigger, setFindMeTrigger] = useState(0);
  const [fitMapTrigger, setFitMapTrigger] = useState(0);

  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const socketRef = useRef(null);
  const webrtcManagerRef = useRef(null);
  const audioSynthRef = useRef(null);
  const roomDataRef = useRef(null);

  useEffect(() => {
    fetch('/api/rooms/default')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.room) {
          setRoomData(data.room);
          roomDataRef.current = data.room;
        }
      })
      .catch((err) => console.warn('Could not load room layout from API:', err));
  }, []);

  useEffect(() => {
    const handleUserGesture = () => {
      spatialMixerInstance.resume();
    };

    window.addEventListener('click', handleUserGesture, { once: false });
    window.addEventListener('keydown', handleUserGesture, { once: false });

    const unsubscribeAudioState = spatialMixerInstance.onAudioStateChange((state) => {
      setAudioEngineState(state);
    });

    return () => {
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
      unsubscribeAudioState();
    };
  }, []);

  useEffect(() => {
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    const webrtc = new WebRTCManager(socket, localUser.userId);
    webrtcManagerRef.current = webrtc;

    const unsubVolume = webrtc.onVolumeUpdate((vol) => setMicVolume(vol));
    const unsubStatus = webrtc.onStatusUpdate((status) => setMicStatus(status));

    audioSynthRef.current = new AudioSynthesizerDemo(spatialMixerInstance.ensureAudioContext());

    socket.on('connect', () => {
      console.log('[Socket] Connected to ProxiSpeak signaling server:', socket.id);
      setIsConnected(true);

      socket.emit(
        'join-world',
        {
          userId: localUser.userId,
          username: localUser.username,
          role: localUser.role,
          avatarColor: localUser.avatarColor,
          initialCoordinates: localUser.coordinates,
        },
        (response) => {
          if (response && response.status === 'success') {
            console.log('[Socket] Successfully registered in virtual office!');
            if (response.allActiveUsers) {
              setRemotePeers(response.allActiveUsers);
            }
            if (response.initialQueryLatencyMs) {
              setLatencyMs(response.initialQueryLatencyMs);
            }
          }
        }
      );
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from signaling server');
      setIsConnected(false);
    });

    socket.on('peer-joined-world', (peer) => {
      setRemotePeers((prev) => {
        const filtered = prev.filter((p) => p.userId !== peer.userId);
        return [...filtered, peer];
      });
    });

    socket.on('peer-moved', ({ userId, coordinates, facingAngle, isSpeaking: peerSpeaking }) => {
      setRemotePeers((prev) =>
        prev.map((p) =>
          p.userId === userId
            ? { ...p, coordinates, facingAngle, ...(peerSpeaking !== undefined && { isSpeaking: peerSpeaking }) }
            : p
        )
      );

      const walls = roomDataRef.current?.walls || [];
      const metrics = spatialMixerInstance.updatePeerSpatial(
        userId,
        localUser.coordinates,
        coordinates,
        localUser.facingAngle || 0,
        walls
      );

      setPeersInEarshot((prev) =>
        prev.map((p) => (p.userId === userId ? { ...p, coordinates, ...metrics } : p))
      );
    });

    socket.on('peers-batch-moved', (movedPeers) => {
      setRemotePeers((prev) => {
        const movedMap = new Map(movedPeers.map((m) => [m.userId, m]));
        return prev.map((p) => {
          const updated = movedMap.get(p.userId);
          return updated ? { ...p, coordinates: updated.coordinates, isSpeaking: updated.isSpeaking } : p;
        });
      });
    });

    socket.on('peer-entered-earshot', ({ peer, shouldInitiateOffer }) => {
      console.log(`[ProxiSpeak] Peer ${peer.userId} is within 100px earshot! Initializing WebRTC audio...`);

      webrtc.handlePeerEnteredEarshot(peer, shouldInitiateOffer);

      if (peer.isBot || peer.userId.startsWith('bot-')) {
        const synthStream = audioSynthRef.current.createVoiceStream(peer.userId);
        spatialMixerInstance.addPeerStream(peer.userId, synthStream);
      }

      const walls = roomDataRef.current?.walls || [];
      const metrics = spatialMixerInstance.updatePeerSpatial(
        peer.userId,
        localUser.coordinates,
        peer.coordinates || [peer.x, peer.y],
        localUser.facingAngle || 0,
        walls
      );

      setPeersInEarshot((prev) => {
        const filtered = prev.filter((p) => p.userId !== peer.userId);
        return [...filtered, { ...peer, ...metrics }];
      });
    });

    socket.on('peer-left-earshot', ({ peerId }) => {
      console.log(`[ProxiSpeak] Peer ${peerId} moved outside 100px earshot. Tearing down audio stream.`);
      webrtc.handlePeerLeftEarshot(peerId);
      if (audioSynthRef.current) {
        audioSynthRef.current.stopVoiceStream(peerId);
      }
      setPeersInEarshot((prev) => prev.filter((p) => p.userId !== peerId));
    });

    socket.on('peer-distance-update', ({ peerId, coordinates, distance, normalizedGain }) => {
      const walls = roomDataRef.current?.walls || [];
      const metrics = spatialMixerInstance.updatePeerSpatial(
        peerId,
        localUser.coordinates,
        coordinates,
        localUser.facingAngle || 0,
        walls
      );

      setPeersInEarshot((prev) =>
        prev.map((p) => (p.userId === peerId ? { ...p, coordinates, distance, ...metrics } : p))
      );
    });

    socket.on('webrtc-offer', ({ fromUserId, sdp }) => {
      webrtc.handleOffer(fromUserId, sdp);
    });

    socket.on('webrtc-answer', ({ fromUserId, sdp }) => {
      webrtc.handleAnswer(fromUserId, sdp);
    });

    socket.on('webrtc-ice-candidate', ({ fromUserId, candidate }) => {
      webrtc.handleIceCandidate(fromUserId, candidate);
    });

    socket.on('peer-voice-status-changed', ({ userId, isSpeaking: peerSpeaking, isMuted: peerMuted }) => {
      setRemotePeers((prev) =>
        prev.map((p) =>
          p.userId === userId
            ? { ...p, ...(peerSpeaking !== undefined && { isSpeaking: peerSpeaking }), ...(peerMuted !== undefined && { isMuted: peerMuted }) }
            : p
        )
      );
      setPeersInEarshot((prev) =>
        prev.map((p) =>
          p.userId === userId
            ? { ...p, ...(peerSpeaking !== undefined && { isSpeaking: peerSpeaking }), ...(peerMuted !== undefined && { isMuted: peerMuted }) }
            : p
        )
      );
    });

    socket.on('peer-left-world', ({ userId }) => {
      setRemotePeers((prev) => prev.filter((p) => p.userId !== userId));
      setPeersInEarshot((prev) => prev.filter((p) => p.userId !== userId));
      webrtc.handlePeerLeftEarshot(userId);
      if (audioSynthRef.current) {
        audioSynthRef.current.stopVoiceStream(userId);
      }
    });

    webrtc.initLocalStream();

    return () => {
      unsubVolume();
      unsubStatus();
      socket.disconnect();
      webrtc.destroy();
      if (audioSynthRef.current) audioSynthRef.current.stopAll();
      spatialMixerInstance.destroy();
    };
  }, []);

  const handleLocalMove = useCallback(
    (newCoords, facingAngle) => {
      setLocalUser((prev) => ({ ...prev, coordinates: newCoords, facingAngle }));

      if (socketRef.current) {
        socketRef.current.emit('avatar-move', {
          userId: localUser.userId,
          coordinates: newCoords,
          facingAngle,
          isSpeaking,
        });
      }

      const walls = roomDataRef.current?.walls || [];
      setPeersInEarshot((prev) =>
        prev.map((peer) => {
          const peerCoords = peer.coordinates || [peer.x || 0, peer.y || 0];
          const metrics = spatialMixerInstance.updatePeerSpatial(
            peer.userId,
            newCoords,
            peerCoords,
            facingAngle,
            walls
          );
          return { ...peer, ...metrics };
        })
      );
    },
    [localUser.userId, isSpeaking]
  );

  const handleToggleMic = () => {
    if (webrtcManagerRef.current) {
      const active = webrtcManagerRef.current.toggleMicrophone();
      setIsMicMuted(!active);
    }
  };

  const handleToggleDeafen = () => {
    const nextDeaf = !isDeafened;
    setIsDeafened(nextDeaf);
    spatialMixerInstance.setDeafened(nextDeaf);
  };

  const handleVolumeChange = (vol) => {
    setMasterVolume(vol);
    spatialMixerInstance.setMasterVolume(vol);
  };

  const handleToggle3D = () => {
    const next3D = !enable3DPanning;
    setEnable3DPanning(next3D);
    spatialMixerInstance.set3DPanningEnabled(next3D);
  };

  const handleToggleOcclusion = () => {
    const nextOcc = !enableOcclusion;
    setEnableOcclusion(nextOcc);
    spatialMixerInstance.setOcclusionEnabled(nextOcc);
  };

  const handleToggleLoopback = () => {
    if (webrtcManagerRef.current) {
      const active = webrtcManagerRef.current.toggleLoopback();
      setIsLoopbackActive(active);
    }
  };

  const handleCenterOnMe = () => {
    setFindMeTrigger((prev) => prev + 1);
  };

  const handleFitEntireMap = () => {
    setFitMapTrigger((prev) => prev + 1);
  };

  const handleResumeAudio = () => {
    spatialMixerInstance.resume();
  };

  const handleTeleport = (targetCoords) => {
    handleLocalMove(targetCoords, localUser.facingAngle || 0);
    handleCenterOnMe();
  };

  const handleSpawnBots = async (count = 50) => {
    try {
      const res = await fetch('/api/users/swarm/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (data.success) {
        const usersRes = await fetch('/api/users/active');
        const usersData = await usersRes.json();
        if (usersData.success) {
          setRemotePeers(usersData.users.filter((u) => u.userId !== localUser.userId));
        }
      }
    } catch (err) {
      console.error('Failed to spawn bot swarm:', err);
    }
  };

  const handleClearBots = async () => {
    try {
      await fetch('/api/users/swarm/clear', { method: 'POST' });
      setRemotePeers((prev) => prev.filter((p) => !p.isBot));
      setPeersInEarshot((prev) => prev.filter((p) => !p.isBot));
      if (audioSynthRef.current) audioSynthRef.current.stopAll();
    } catch (err) {
      console.error('Failed to clear bots:', err);
    }
  };

  useEffect(() => {
    const wanderInterval = setInterval(() => {
      setRemotePeers((prev) => {
        const hasBots = prev.some((p) => p.isBot);
        if (!hasBots) return prev;

        const updated = prev.map((p) => {
          if (!p.isBot) return p;
          const dx = (Math.random() - 0.5) * 6;
          const dy = (Math.random() - 0.5) * 6;
          const currentX = p.coordinates ? p.coordinates[0] : 800;
          const currentY = p.coordinates ? p.coordinates[1] : 400;
          const newX = Math.max(80, Math.min(1720, Math.round(currentX + dx)));
          const newY = Math.max(80, Math.min(1020, Math.round(currentY + dy)));
          return {
            ...p,
            coordinates: [newX, newY],
            isSpeaking: Math.random() < 0.3,
          };
        });

        const walls = roomDataRef.current?.walls || [];
        const inEarshotBots = updated.filter((p) => {
          const [bx, by] = p.coordinates;
          const [lx, ly] = localUser.coordinates;
          return Math.hypot(bx - lx, by - ly) <= 100;
        });

        if (syntheticChatterEnabled && audioSynthRef.current) {
          inEarshotBots.forEach((bot) => {
            if (!spatialMixerInstance.peerNodes.has(bot.userId)) {
              const stream = audioSynthRef.current.createVoiceStream(bot.userId);
              spatialMixerInstance.addPeerStream(bot.userId, stream);
            }
            spatialMixerInstance.updatePeerSpatial(
              bot.userId,
              localUser.coordinates,
              bot.coordinates,
              localUser.facingAngle || 0,
              walls
            );
          });
        }

        return updated;
      });
    }, 1500);

    return () => clearInterval(wanderInterval);
  }, [localUser.coordinates, localUser.facingAngle, syntheticChatterEnabled]);

  const handleSaveProfile = (updatedProfile) => {
    setLocalUser((prev) => ({ ...prev, ...updatedProfile }));
    if (socketRef.current) {
      socketRef.current.emit('join-world', {
        userId: localUser.userId,
        ...updatedProfile,
        initialCoordinates: localUser.coordinates,
      });
    }
  };

  const botCount = remotePeers.filter((p) => p.isBot).length;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0e17] select-none">
      {/* Autoplay Suspended Reminder Banner */}
      {audioEngineState === 'suspended' && (
        <div
          onClick={handleResumeAudio}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs flex items-center gap-2 shadow-2xl cursor-pointer animate-bounce border border-amber-300"
        >
          <span>🔊 Audio is paused by your browser. Click here to enable full spatial audio!</span>
        </div>
      )}

      {/* 1. Header Navigation Bar */}
      <HeaderNav
        isConnected={isConnected}
        fps={fps}
        latencyMs={latencyMs}
        onOpenAudit={() => setIsAuditOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onTeleport={handleTeleport}
        onFitEntireMap={handleFitEntireMap}
        onFocusAvatar={handleCenterOnMe}
        user={localUser}
      />

      {/* Interactive Quick Start Onboarding Guide */}
      <QuickStartGuide
        onCenterOnMe={handleCenterOnMe}
        onSpawnBots={handleSpawnBots}
        onToggleLoopback={handleToggleLoopback}
        isLoopbackActive={isLoopbackActive}
        micVolume={micVolume}
      />

      {/* 2. Top-Right Proximity Radar HUD */}
      <div className="fixed top-20 right-4 z-30">
        <ProximityRadar peersInEarshot={peersInEarshot} localCoords={localUser.coordinates} />
      </div>

      {/* 3. Top-Left 50+ Bot Swarm Simulator Controller */}
      <div className="fixed top-20 left-4 z-30 w-auto max-w-sm">
        <BotSwarmController
          botCount={botCount}
          onSpawnBots={handleSpawnBots}
          onClearBots={handleClearBots}
          syntheticChatterEnabled={syntheticChatterEnabled}
          onToggleSyntheticChatter={() => setSyntheticChatterEnabled((prev) => !prev)}
        />
      </div>

      {/* 4. Main 2D Virtual Office Canvas (Steady 60 FPS Canvas Engine) */}
      <VirtualOfficeCanvas
        localUser={localUser}
        remotePeers={remotePeers}
        roomData={roomData}
        onMove={handleLocalMove}
        isSpeaking={isSpeaking}
        earshotRadius={100}
        onZoneChange={setCurrentZone}
        onFpsUpdate={setFps}
        findMeTrigger={findMeTrigger}
        fitMapTrigger={fitMapTrigger}
      />

      {/* 5. Bottom Audio Controls Bar with Live VU Meter and Find Me */}
      <AudioControlsBar
        isMicMuted={isMicMuted}
        isDeafened={isDeafened}
        onToggleMic={handleToggleMic}
        onToggleDeafen={handleToggleDeafen}
        masterVolume={masterVolume}
        onVolumeChange={handleVolumeChange}
        enable3DPanning={enable3DPanning}
        onToggle3DPanning={handleToggle3D}
        enableOcclusion={enableOcclusion}
        onToggleOcclusion={handleToggleOcclusion}
        activePeersCount={peersInEarshot.length}
        currentZone={currentZone}
        micVolume={micVolume}
        micStatus={micStatus}
        isLoopbackActive={isLoopbackActive}
        onToggleLoopback={handleToggleLoopback}
        onCenterOnMe={handleCenterOnMe}
        onFitEntireMap={handleFitEntireMap}
        audioEngineState={audioEngineState}
        onResumeAudio={handleResumeAudio}
        localUser={localUser}
      />

      {/* 6. Modals */}
      <SpatialBenchmarkModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} />
      <AudioGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={localUser}
        onSave={handleSaveProfile}
      />
    </div>
  );
}

export default App;
