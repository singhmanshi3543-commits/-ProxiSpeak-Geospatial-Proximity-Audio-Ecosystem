import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Target,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Navigation,
} from 'lucide-react';
import OfficeWorld from '../canvas/OfficeWorld.js';
import AvatarRenderer from '../canvas/AvatarRenderer.js';

const DEFAULT_MAP_WIDTH = 1800;
const DEFAULT_MAP_HEIGHT = 1100;
const AVATAR_RADIUS = 16;
const MOVE_SPEED = 3.6;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.8;
const EMIT_THROTTLE_MS = 48;

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function checkPositionCollides(x, y, radius = AVATAR_RADIUS, roomData) {
  const mapWidth = roomData?.dimensions?.width || DEFAULT_MAP_WIDTH;
  const mapHeight = roomData?.dimensions?.height || DEFAULT_MAP_HEIGHT;

  if (x < 45 || x > mapWidth - 45 || y < 45 || y > mapHeight - 45) {
    return true;
  }

  const walls = roomData?.walls || [];
  for (const wall of walls) {
    if (typeof wall.x1 !== 'number' || typeof wall.y1 !== 'number') continue;
    const wallThick = (wall.thickness || 10) / 2;
    const dist = distanceToSegment(x, y, wall.x1, wall.y1, wall.x2, wall.y2);
    if (dist < radius + wallThick) {
      return true;
    }
  }

  const furniture = roomData?.furniture || [];
  for (const item of furniture) {
    if (item.type === 'desk' || item.type === 'server_rack') {
      const margin = radius * 0.7;
      if (
        x >= item.x - margin &&
        x <= item.x + item.width + margin &&
        y >= item.y - margin &&
        y <= item.y + item.height + margin
      ) {
        return true;
      }
    }
  }

  return false;
}

function moveWithCollision(currentX, currentY, dx, dy, radius = AVATAR_RADIUS, roomData) {
  const targetX = currentX + dx;
  const targetY = currentY + dy;

  if (!checkPositionCollides(targetX, targetY, radius, roomData)) {
    return { x: targetX, y: targetY };
  }

  if (dx !== 0 && !checkPositionCollides(targetX, currentY, radius, roomData)) {
    return { x: targetX, y: currentY };
  }

  if (dy !== 0 && !checkPositionCollides(currentX, targetY, radius, roomData)) {
    return { x: currentX, y: targetY };
  }

  return { x: currentX, y: currentY };
}

export function VirtualOfficeCanvas({
  localUser,
  remotePeers = [],
  roomData,
  onMove,
  isSpeaking = false,
  earshotRadius = 100,
  onZoneChange,
  onFpsUpdate,
  findMeTrigger,
  fitMapTrigger,
}) {
  const canvasRef = useRef(null);
  const miniMapCanvasRef = useRef(null);
  const officeWorldRef = useRef(null);

  const localUserRef = useRef(localUser);
  useEffect(() => {
    localUserRef.current = localUser;
  }, [localUser]);

  const roomDataRef = useRef(roomData);
  useEffect(() => {
    roomDataRef.current = roomData;
  }, [roomData]);

  const isSpeakingRef = useRef(isSpeaking);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const earshotRadiusRef = useRef(earshotRadius);
  useEffect(() => {
    earshotRadiusRef.current = earshotRadius;
  }, [earshotRadius]);

  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const onZoneChangeRef = useRef(onZoneChange);
  useEffect(() => {
    onZoneChangeRef.current = onZoneChange;
  }, [onZoneChange]);

  const onFpsUpdateRef = useRef(onFpsUpdate);
  useEffect(() => {
    onFpsUpdateRef.current = onFpsUpdate;
  }, [onFpsUpdate]);

  const initialX = localUser?.coordinates?.[0] ?? 600;
  const initialY = localUser?.coordinates?.[1] ?? 350;

  const localPosRef = useRef({
    x: initialX,
    y: initialY,
    facingAngle: localUser?.facingAngle || 0,
  });

  const [zoomLevel, setZoomLevel] = useState(0.85);
  const zoomRef = useRef(0.85);
  const cameraFocusRef = useRef({ x: initialX, y: initialY });
  const isFollowingAvatarRef = useRef(true);

  const [offScreenAvatar, setOffScreenAvatar] = useState(null);
  const offScreenAvatarRef = useRef(null);

  const isRightDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const waypointRef = useRef(null);
  const keysDownRef = useRef(new Set());
  const lastEmitTimeRef = useRef(0);
  const animationFrameIdRef = useRef(null);

  const peerPositionsRef = useRef(new Map());

  const fpsTrackerRef = useRef({ frames: 0, lastTime: performance.now(), fps: 60 });
  const beaconTimeRef = useRef(0);

  const triggerBeaconPing = useCallback(() => {
    beaconTimeRef.current = performance.now();
    isFollowingAvatarRef.current = true;
    cameraFocusRef.current.x = localPosRef.current.x;
    cameraFocusRef.current.y = localPosRef.current.y;
  }, []);

  const handleFocusAvatar = useCallback(() => {
    isFollowingAvatarRef.current = true;
    cameraFocusRef.current.x = localPosRef.current.x;
    cameraFocusRef.current.y = localPosRef.current.y;
    zoomRef.current = 0.95;
    setZoomLevel(0.95);
    triggerBeaconPing();
  }, [triggerBeaconPing]);

  const handleFitEntireMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mapWidth = roomDataRef.current?.dimensions?.width || DEFAULT_MAP_WIDTH;
    const mapHeight = roomDataRef.current?.dimensions?.height || DEFAULT_MAP_HEIGHT;

    const viewW = canvas.width * 0.94;
    const viewH = (canvas.height - 150) * 0.92;
    const scaleX = viewW / mapWidth;
    const scaleY = viewH / mapHeight;
    const fitZoom = Math.max(MIN_ZOOM, Math.min(1.2, Math.min(scaleX, scaleY)));

    zoomRef.current = fitZoom;
    setZoomLevel(Math.round(fitZoom * 100) / 100);

    isFollowingAvatarRef.current = false;
    cameraFocusRef.current.x = mapWidth / 2;
    cameraFocusRef.current.y = mapHeight / 2;
  }, []);

  const checkCurrentZone = useCallback((x, y) => {
    const zones = roomDataRef.current?.zones;
    if (!zones) return 'Infotact HQ';
    for (const zone of zones) {
      if (zone.boundingBox && Array.isArray(zone.boundingBox)) {
        const [[x1, y1], [x2, y2]] = zone.boundingBox;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          return zone.name;
        }
      }
    }
    return 'Open Workspace';
  }, []);

  const handleDirectionalPress = useCallback((dir, e) => {
    if (e) {
      e.preventDefault();
      e.currentTarget.blur();
    }
    waypointRef.current = null;
    isFollowingAvatarRef.current = true;
    keysDownRef.current.add(dir);

    const step = 22;
    let dx = 0;
    let dy = 0;
    if (dir === 'arrowup' || dir === 'w') dy = -step;
    if (dir === 'arrowdown' || dir === 's') dy = step;
    if (dir === 'arrowleft' || dir === 'a') dx = -step;
    if (dir === 'arrowright' || dir === 'd') dx = step;

    const resolved = moveWithCollision(
      localPosRef.current.x,
      localPosRef.current.y,
      dx,
      dy,
      AVATAR_RADIUS,
      roomDataRef.current
    );

    if (resolved.x !== localPosRef.current.x || resolved.y !== localPosRef.current.y) {
      localPosRef.current.x = resolved.x;
      localPosRef.current.y = resolved.y;
      localPosRef.current.facingAngle = Math.atan2(dy, dx);
      const zone = checkCurrentZone(resolved.x, resolved.y);
      if (onMoveRef.current) {
        onMoveRef.current([Math.round(resolved.x), Math.round(resolved.y)], localPosRef.current.facingAngle);
      }
      if (onZoneChangeRef.current) {
        onZoneChangeRef.current(zone);
      }
    }
  }, [checkCurrentZone]);

  const handleDirectionalRelease = useCallback((dir, e) => {
    if (e) {
      e.preventDefault();
      e.currentTarget.blur();
    }
    keysDownRef.current.delete(dir);
  }, []);

  const getDirectionalProps = (dir) => ({
    onMouseDown: (e) => handleDirectionalPress(dir, e),
    onMouseUp: (e) => handleDirectionalRelease(dir, e),
    onMouseLeave: (e) => handleDirectionalRelease(dir, e),
    onTouchStart: (e) => handleDirectionalPress(dir, e),
    onTouchEnd: (e) => handleDirectionalRelease(dir, e),
    onTouchCancel: (e) => handleDirectionalRelease(dir, e),
    onClick: (e) => e.currentTarget.blur(),
  });

  useEffect(() => {
    if (findMeTrigger) {
      handleFocusAvatar();
    }
  }, [findMeTrigger, handleFocusAvatar]);

  useEffect(() => {
    if (fitMapTrigger) {
      handleFitEntireMap();
    }
  }, [fitMapTrigger, handleFitEntireMap]);

  const coordX = localUser?.coordinates?.[0];
  const coordY = localUser?.coordinates?.[1];
  const hasInitializedCameraRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedCameraRef.current && typeof coordX === 'number' && typeof coordY === 'number') {
      hasInitializedCameraRef.current = true;
      cameraFocusRef.current.x = coordX;
      cameraFocusRef.current.y = coordY;
      localPosRef.current.x = coordX;
      localPosRef.current.y = coordY;
      isFollowingAvatarRef.current = true;
      triggerBeaconPing();
    }
  }, [coordX, coordY, triggerBeaconPing]);

  useEffect(() => {
    if (!officeWorldRef.current) {
      officeWorldRef.current = new OfficeWorld(roomData);
    } else {
      officeWorldRef.current.setRoomData(roomData);
    }
  }, [roomData]);

  useEffect(() => {
    if (typeof coordX !== 'number' || typeof coordY !== 'number') return;
    const current = localPosRef.current;
    if (Math.hypot(coordX - current.x, coordY - current.y) > 80) {
      current.x = coordX;
      current.y = coordY;
      waypointRef.current = null;
      cameraFocusRef.current.x = coordX;
      cameraFocusRef.current.y = coordY;
      isFollowingAvatarRef.current = true;
    }
  }, [coordX, coordY]);

  useEffect(() => {
    const map = peerPositionsRef.current;
    const currentPeerIds = new Set();

    (remotePeers || []).forEach((peer) => {
      currentPeerIds.add(peer.userId);
      const existing = map.get(peer.userId);
      const px = peer.coordinates ? peer.coordinates[0] : peer.x || 0;
      const py = peer.coordinates ? peer.coordinates[1] : peer.y || 0;

      if (!existing) {
        map.set(peer.userId, {
          ...peer,
          x: px,
          y: py,
          targetX: px,
          targetY: py,
          facingAngle: peer.facingAngle || 0,
        });
      } else {
        existing.targetX = px;
        existing.targetY = py;
        existing.username = peer.username;
        existing.role = peer.role;
        existing.avatarColor = peer.avatarColor;
        existing.isSpeaking = peer.isSpeaking;
        existing.isMuted = peer.isMuted;
        existing.isBot = peer.isBot;
        if (peer.facingAngle !== undefined) existing.facingAngle = peer.facingAngle;
      }
    });

    for (const [id] of map.entries()) {
      if (!currentPeerIds.has(id)) {
        map.delete(id);
      }
    }
  }, [remotePeers]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        e.preventDefault();
        keysDownRef.current.add(key);
        waypointRef.current = null;
        isFollowingAvatarRef.current = true;
      } else if (key === ' ' || key === 'c') {
        e.preventDefault();
        handleFocusAvatar();
      } else if (key === 'f' || key === 'm') {
        e.preventDefault();
        handleFitEntireMap();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      keysDownRef.current.delete(key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleFocusAvatar, handleFitEntireMap]);

  useEffect(() => {
    const handleWindowMouseUp = () => {
      isRightDraggingRef.current = false;
    };
    const handleBlur = () => {
      keysDownRef.current.clear();
      isRightDraggingRef.current = false;
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();

      const mapWidth = roomDataRef.current?.dimensions?.width || DEFAULT_MAP_WIDTH;
      const mapHeight = roomDataRef.current?.dimensions?.height || DEFAULT_MAP_HEIGHT;

      if (e.ctrlKey) {
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * zoomFactor));
        zoomRef.current = newZoom;
        setZoomLevel(Math.round(newZoom * 100) / 100);
      } else if (e.shiftKey) {
        isFollowingAvatarRef.current = false;
        cameraFocusRef.current.x = Math.max(100, Math.min(mapWidth - 100, cameraFocusRef.current.x + e.deltaY * 0.9));
      } else {
        isFollowingAvatarRef.current = false;
        cameraFocusRef.current.y = Math.max(100, Math.min(mapHeight - 100, cameraFocusRef.current.y + e.deltaY * 0.9));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e) => {
    if (e.button === 2 || e.button === 1 || e.altKey) {
      e.preventDefault();
      isRightDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button === 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const zoom = zoomRef.current;
      const worldX = Math.round((screenX - canvas.width / 2) / zoom + cameraFocusRef.current.x);
      const worldY = Math.round((screenY - canvas.height / 2) / zoom + cameraFocusRef.current.y);

      const mapWidth = roomDataRef.current?.dimensions?.width || DEFAULT_MAP_WIDTH;
      const mapHeight = roomDataRef.current?.dimensions?.height || DEFAULT_MAP_HEIGHT;

      const clampedX = Math.max(30, Math.min(mapWidth - 30, worldX));
      const clampedY = Math.max(30, Math.min(mapHeight - 30, worldY));

      waypointRef.current = { x: clampedX, y: clampedY };
      isFollowingAvatarRef.current = true;
    }
  };

  const handleMouseMove = (e) => {
    if (isRightDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const zoom = zoomRef.current;

      const mapWidth = roomDataRef.current?.dimensions?.width || DEFAULT_MAP_WIDTH;
      const mapHeight = roomDataRef.current?.dimensions?.height || DEFAULT_MAP_HEIGHT;

      isFollowingAvatarRef.current = false;
      cameraFocusRef.current.x = Math.max(50, Math.min(mapWidth - 50, cameraFocusRef.current.x - dx / zoom));
      cameraFocusRef.current.y = Math.max(50, Math.min(mapHeight - 50, cameraFocusRef.current.y - dy / zoom));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    isRightDraggingRef.current = false;
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoomRef.current * 1.25);
    zoomRef.current = newZoom;
    setZoomLevel(Math.round(newZoom * 100) / 100);
  }, []);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoomRef.current * 0.8);
    zoomRef.current = newZoom;
    setZoomLevel(Math.round(newZoom * 100) / 100);
  }, []);

  const handleMiniMapClick = (e) => {
    const miniCanvas = miniMapCanvasRef.current;
    if (!miniCanvas) return;
    const rect = miniCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const mapWidth = roomDataRef.current?.dimensions?.width || DEFAULT_MAP_WIDTH;
    const mapHeight = roomDataRef.current?.dimensions?.height || DEFAULT_MAP_HEIGHT;

    cameraFocusRef.current.x = (clickX / miniCanvas.width) * mapWidth;
    cameraFocusRef.current.y = (clickY / miniCanvas.height) * mapHeight;
    isFollowingAvatarRef.current = false;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = (time) => {
      fpsTrackerRef.current.frames++;
      if (time - fpsTrackerRef.current.lastTime >= 1000) {
        const fps = Math.round((fpsTrackerRef.current.frames * 1000) / (time - fpsTrackerRef.current.lastTime));
        fpsTrackerRef.current.fps = fps;
        fpsTrackerRef.current.frames = 0;
        fpsTrackerRef.current.lastTime = time;
        if (onFpsUpdateRef.current) {
          onFpsUpdateRef.current(fps);
        }
      }

      const keys = keysDownRef.current;
      let dx = 0;
      let dy = 0;

      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;

      const currentRoom = roomDataRef.current;
      const mapWidth = currentRoom?.dimensions?.width || DEFAULT_MAP_WIDTH;
      const mapHeight = currentRoom?.dimensions?.height || DEFAULT_MAP_HEIGHT;

      let moved = false;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx = (dx / len) * MOVE_SPEED;
        dy = (dy / len) * MOVE_SPEED;

        const resolved = moveWithCollision(
          localPosRef.current.x,
          localPosRef.current.y,
          dx,
          dy,
          AVATAR_RADIUS,
          currentRoom
        );

        if (resolved.x !== localPosRef.current.x || resolved.y !== localPosRef.current.y) {
          localPosRef.current.x = resolved.x;
          localPosRef.current.y = resolved.y;
          localPosRef.current.facingAngle = Math.atan2(dy, dx);
          moved = true;
        }
      } else if (waypointRef.current) {
        const wx = waypointRef.current.x;
        const wy = waypointRef.current.y;
        const distToWp = Math.hypot(wx - localPosRef.current.x, wy - localPosRef.current.y);

        if (distToWp < MOVE_SPEED) {
          localPosRef.current.x = wx;
          localPosRef.current.y = wy;
          waypointRef.current = null;
        } else {
          const wdx = (wx - localPosRef.current.x) / distToWp;
          const wdy = (wy - localPosRef.current.y) / distToWp;

          const resolved = moveWithCollision(
            localPosRef.current.x,
            localPosRef.current.y,
            wdx * MOVE_SPEED,
            wdy * MOVE_SPEED,
            AVATAR_RADIUS,
            currentRoom
          );

          if (resolved.x === localPosRef.current.x && resolved.y === localPosRef.current.y) {
            waypointRef.current = null;
          } else {
            localPosRef.current.x = resolved.x;
            localPosRef.current.y = resolved.y;
            localPosRef.current.facingAngle = Math.atan2(wdy, wdx);
            moved = true;
          }
        }
      }

      if (isFollowingAvatarRef.current) {
        const followSpeed = 0.16;
        cameraFocusRef.current.x += (localPosRef.current.x - cameraFocusRef.current.x) * followSpeed;
        cameraFocusRef.current.y += (localPosRef.current.y - cameraFocusRef.current.y) * followSpeed;
      }

      const zoom = zoomRef.current;
      const screenLocalX = (localPosRef.current.x - cameraFocusRef.current.x) * zoom + canvas.width / 2;
      const screenLocalY = (localPosRef.current.y - cameraFocusRef.current.y) * zoom + canvas.height / 2;
      const isOffScreen = screenLocalX < 40 || screenLocalX > canvas.width - 40 || screenLocalY < 40 || screenLocalY > canvas.height - 40;

      if (isOffScreen && !isFollowingAvatarRef.current) {
        const distToCamera = Math.hypot(localPosRef.current.x - cameraFocusRef.current.x, localPosRef.current.y - cameraFocusRef.current.y);
        const angle = Math.atan2(screenLocalY - canvas.height / 2, screenLocalX - canvas.width / 2);
        const screenX = Math.max(50, Math.min(canvas.width - 50, screenLocalX));
        const screenY = Math.max(50, Math.min(canvas.height - 50, screenLocalY));
        const roundedDist = Math.round(distToCamera);

        const prev = offScreenAvatarRef.current;
        if (!prev || Math.abs(prev.dist - roundedDist) > 5 || Math.abs(prev.screenX - screenX) > 4 || Math.abs(prev.screenY - screenY) > 4 || Math.abs(prev.angle - angle) > 0.05) {
          const nextState = { dist: roundedDist, angle, screenX, screenY };
          offScreenAvatarRef.current = nextState;
          setOffScreenAvatar(nextState);
        }
      } else if (offScreenAvatarRef.current !== null) {
        offScreenAvatarRef.current = null;
        setOffScreenAvatar(null);
      }

      if (moved && time - lastEmitTimeRef.current > EMIT_THROTTLE_MS) {
        lastEmitTimeRef.current = time;
        const currentZone = checkCurrentZone(localPosRef.current.x, localPosRef.current.y);
        if (onMoveRef.current) {
          onMoveRef.current([Math.round(localPosRef.current.x), Math.round(localPosRef.current.y)], localPosRef.current.facingAngle);
        }
        if (onZoneChangeRef.current) {
          onZoneChangeRef.current(currentZone);
        }
      }

      peerPositionsRef.current.forEach((peer) => {
        const lerpFactor = 0.22;
        peer.x += (peer.targetX - peer.x) * lerpFactor;
        peer.y += (peer.targetY - peer.y) * lerpFactor;
      });

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cameraFocusRef.current.x, -cameraFocusRef.current.y);

      if (officeWorldRef.current) {
        officeWorldRef.current.render(ctx, mapWidth, mapHeight, time, waypointRef.current);
      }

      peerPositionsRef.current.forEach((peer) => {
        AvatarRenderer.renderAvatar(
          ctx,
          {
            x: peer.x,
            y: peer.y,
            username: peer.username,
            role: peer.role,
            avatarColor: peer.avatarColor,
            facingAngle: peer.facingAngle || 0,
            isSpeaking: peer.isSpeaking,
            isMuted: peer.isMuted,
            isBot: peer.isBot,
          },
          false,
          time,
          earshotRadiusRef.current
        );
      });

      const local = localUserRef.current || {};
      AvatarRenderer.renderAvatar(
        ctx,
        {
          x: localPosRef.current.x,
          y: localPosRef.current.y,
          username: local.username || 'You',
          role: local.role || 'Member',
          avatarColor: local.avatarColor || '#f59e0b',
          facingAngle: localPosRef.current.facingAngle,
          isSpeaking: isSpeakingRef.current,
          isMuted: Boolean(local.isMuted),
          isBot: false,
        },
        true,
        time,
        earshotRadiusRef.current
      );

      const timeSinceBeacon = time - beaconTimeRef.current;
      if (timeSinceBeacon < 2200) {
        ctx.save();
        const progress = timeSinceBeacon / 2200;
        const currentRadius = 24 + progress * 180;
        const alpha = Math.max(0, 1 - progress);

        ctx.beginPath();
        ctx.arc(localPosRef.current.x, localPosRef.current.y, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 16;
        ctx.stroke();

        ctx.font = 'bold 13px "Outfit", sans-serif';
        ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
        ctx.textAlign = 'center';
        ctx.fillText('⭐ YOU ARE HERE!', localPosRef.current.x, localPosRef.current.y - currentRadius - 8);
        ctx.restore();
      }

      ctx.restore();

      const miniCanvas = miniMapCanvasRef.current;
      if (miniCanvas) {
        const mCtx = miniCanvas.getContext('2d');
        if (mCtx) {
          mCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);

          const mScaleX = miniCanvas.width / mapWidth;
          const mScaleY = miniCanvas.height / mapHeight;

          mCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          mCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

          if (currentRoom?.zones) {
            currentRoom.zones.forEach((z) => {
              if (z.boundingBox && Array.isArray(z.boundingBox)) {
                const [[x1, y1], [x2, y2]] = z.boundingBox;
                mCtx.fillStyle = z.color || 'rgba(59, 130, 246, 0.2)';
                mCtx.fillRect(x1 * mScaleX, y1 * mScaleY, (x2 - x1) * mScaleX, (y2 - y1) * mScaleY);
              }
            });
          }

          if (currentRoom?.walls) {
            mCtx.strokeStyle = '#0284c7';
            mCtx.lineWidth = 1.5;
            currentRoom.walls.forEach((w) => {
              mCtx.beginPath();
              mCtx.moveTo(w.x1 * mScaleX, w.y1 * mScaleY);
              mCtx.lineTo(w.x2 * mScaleX, w.y2 * mScaleY);
              mCtx.stroke();
            });
          }

          peerPositionsRef.current.forEach((p) => {
            mCtx.fillStyle = p.avatarColor || '#38bdf8';
            mCtx.beginPath();
            mCtx.arc(p.x * mScaleX, p.y * mScaleY, 2, 0, Math.PI * 2);
            mCtx.fill();
          });

          mCtx.fillStyle = '#f59e0b';
          mCtx.beginPath();
          mCtx.arc(localPosRef.current.x * mScaleX, localPosRef.current.y * mScaleY, 4, 0, Math.PI * 2);
          mCtx.fill();

          const viewW = (canvas.width / zoom) * mScaleX;
          const viewH = (canvas.height / zoom) * mScaleY;
          const viewX = (cameraFocusRef.current.x - canvas.width / (2 * zoom)) * mScaleX;
          const viewY = (cameraFocusRef.current.y - canvas.height / (2 * zoom)) * mScaleY;

          mCtx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
          mCtx.lineWidth = 1;
          mCtx.strokeRect(viewX, viewY, viewW, viewH);
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [checkCurrentZone]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden select-none cursor-crosshair">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className="w-full h-full block"
      />

      {offScreenAvatar && (
        <button
          onClick={handleFocusAvatar}
          className="fixed z-40 btn-primary px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-2xl border border-amber-300 animate-pulse"
          style={{
            top: `${Math.max(70, Math.min(window.innerHeight - 80, offScreenAvatar.screenY))}px`,
            left: `${Math.max(30, Math.min(window.innerWidth - 180, offScreenAvatar.screenX))}px`,
            transform: 'translate(-50%, -50%)',
          }}
          title="Your avatar is currently outside your view. Click to jump camera to avatar!"
        >
          <Navigation size={13} style={{ transform: `rotate(${offScreenAvatar.angle}rad)` }} />
          <span>YOUR AVATAR ({offScreenAvatar.dist}px)</span>
        </button>
      )}

      <div className="fixed right-5 bottom-24 z-30 flex flex-col gap-2 p-2.5 glass-panel-heavy shadow-2xl border border-white/15 rounded-xl w-60">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 pb-1 border-b border-white/10">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Maximize2 size={13} />
            <span>MAP & AVATAR</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        <button
          id="btn-fit-full-map"
          onClick={(e) => {
            e.currentTarget.blur();
            handleFitEntireMap();
          }}
          className="btn-primary w-full py-2 px-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          title="Fit entire 1800x1100 office map on screen at once (See all 5 rooms & 50 colleagues)"
        >
          <Maximize2 size={15} className="animate-pulse" />
          <span>🗺️ FIT FULL MAP</span>
        </button>

        <button
          id="btn-goto-my-avatar"
          onClick={(e) => {
            e.currentTarget.blur();
            handleFocusAvatar();
          }}
          className="btn-primary w-full py-1.5 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 border border-amber-300 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          title="Snap camera directly onto your glowing avatar (Space / C)"
        >
          <Target size={14} />
          <span>🎯 GO TO MY AVATAR</span>
        </button>

        <div className="p-2 rounded-lg bg-slate-900/80 border border-white/10 flex flex-col items-center gap-1">
          <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1 mb-0.5">
            <Move size={11} className="text-amber-400" />
            <span>WALK AVATAR</span>
          </div>

          <button
            id="btn-move-up"
            {...getDirectionalProps('arrowup')}
            className="btn-icon w-8 h-7 text-amber-300 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-200 border border-white/10 active:scale-95"
            title="Walk Up / North (W / Up Arrow)"
          >
            <ArrowUp size={15} />
          </button>

          <div className="flex items-center gap-1">
            <button
              id="btn-move-left"
              {...getDirectionalProps('arrowleft')}
              className="btn-icon w-8 h-7 text-amber-300 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-200 border border-white/10 active:scale-95"
              title="Walk Left / West (A / Left Arrow)"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              id="btn-move-down"
              {...getDirectionalProps('arrowdown')}
              className="btn-icon w-8 h-7 text-amber-300 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-200 border border-white/10 active:scale-95"
              title="Walk Down / South (S / Down Arrow)"
            >
              <ArrowDown size={15} />
            </button>
            <button
              id="btn-move-right"
              {...getDirectionalProps('arrowright')}
              className="btn-icon w-8 h-7 text-amber-300 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-200 border border-white/10 active:scale-95"
              title="Walk Right / East (D / Right Arrow)"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10">
          <span className="text-[10px] text-slate-400 font-mono">Zoom</span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.currentTarget.blur();
                handleZoomIn();
              }}
              className="btn-icon w-7 h-7 text-slate-200 hover:text-white"
              title="Zoom In (Ctrl + Scroll)"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={(e) => {
                e.currentTarget.blur();
                handleZoomOut();
              }}
              className="btn-icon w-7 h-7 text-slate-200 hover:text-white"
              title="Zoom Out (Ctrl + Scroll)"
            >
              <ZoomOut size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed left-4 bottom-24 z-30 glass-panel p-2 shadow-2xl border border-white/10 hidden md:block">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1 px-1">
          <span className="flex items-center gap-1">
            <Move size={11} className="text-cyan-400" />
            <span>Overview Map</span>
          </span>
          <span className="text-[9px] text-amber-400">Click to jump camera</span>
        </div>
        <canvas
          ref={miniMapCanvasRef}
          width={180}
          height={110}
          onClick={handleMiniMapClick}
          className="rounded-lg border border-white/10 cursor-pointer hover:border-cyan-500/50 transition-colors"
          title="Click anywhere on the mini-map to scroll camera to that room"
        />
      </div>
    </div>
  );
}

export default VirtualOfficeCanvas;
