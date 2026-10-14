/**
 * OfficeWorld: 2D Canvas Virtual Environment Renderer
 * Renders architectural floor grids, office zones, acoustic walls,
 * furniture obstacles, decorative elements, and navigation waypoints.
 */

export const DEFAULT_OFFICE_LAYOUT = {
  roomId: 'infotact-hq',
  name: 'Infotact Solutions - Digital Headquarters',
  dimensions: { width: 1800, height: 1100 },
  earshotThresholdPx: 100,
  maxConcurrentUsers: 100,
  zones: [
    {
      id: 'reception',
      name: 'Reception & Welcome',
      boundingBox: [[580, 50], [860, 240]],
      color: 'rgba(6, 182, 212, 0.12)',
      isQuietZone: false,
    },
    {
      id: 'boardroom',
      name: 'Executive Boardroom',
      boundingBox: [[50, 50], [550, 420]],
      color: 'rgba(59, 130, 246, 0.12)',
      isQuietZone: false,
    },
    {
      id: 'open-workspace',
      name: 'Engineering Hub',
      boundingBox: [[880, 50], [1300, 600]],
      color: 'rgba(16, 185, 129, 0.08)',
      isQuietZone: false,
    },
    {
      id: 'breakroom',
      name: 'Cafeteria & Watercooler',
      boundingBox: [[1350, 50], [1750, 500]],
      color: 'rgba(245, 158, 11, 0.10)',
      isQuietZone: false,
    },
    {
      id: 'quiet-pods',
      name: 'Quiet Focus Pods',
      boundingBox: [[50, 500], [550, 1050]],
      color: 'rgba(139, 92, 246, 0.12)',
      isQuietZone: true,
    },
    {
      id: 'all-hands-lounge',
      name: 'All-Hands Auditorium & Lounge',
      boundingBox: [[620, 680], [1750, 1050]],
      color: 'rgba(236, 72, 153, 0.08)',
      isQuietZone: false,
    },
  ],
  walls: [
    { id: 'w1', x1: 50, y1: 50, x2: 550, y2: 50, thickness: 10, acousticDamping: 0.85, label: 'North Boardroom Wall' },
    { id: 'w2', x1: 550, y1: 50, x2: 550, y2: 240, thickness: 10, acousticDamping: 0.85, label: 'East Boardroom Wall' },
    { id: 'w3', x1: 550, y1: 300, x2: 550, y2: 420, thickness: 10, acousticDamping: 0.85, label: 'East Boardroom Wall (South)' },
    { id: 'w4', x1: 50, y1: 420, x2: 550, y2: 420, thickness: 10, acousticDamping: 0.85, label: 'South Boardroom Wall' },
    { id: 'w5', x1: 1350, y1: 50, x2: 1350, y2: 280, thickness: 10, acousticDamping: 0.80, label: 'Breakroom West Wall' },
    { id: 'w6', x1: 1350, y1: 350, x2: 1350, y2: 500, thickness: 10, acousticDamping: 0.80, label: 'Breakroom West Wall (South)' },
    { id: 'w7', x1: 1350, y1: 500, x2: 1750, y2: 500, thickness: 10, acousticDamping: 0.80, label: 'Breakroom South Wall' },
    { id: 'w8', x1: 50, y1: 500, x2: 550, y2: 500, thickness: 12, acousticDamping: 0.95, label: 'Soundproof Pod Divider' },
    { id: 'w9', x1: 300, y1: 500, x2: 300, y2: 1050, thickness: 12, acousticDamping: 0.95, label: 'Pod Internal Divider' },
    { id: 'w10', x1: 550, y1: 500, x2: 550, y2: 850, thickness: 10, acousticDamping: 0.90, label: 'Quiet Pod Outer Wall' },
    { id: 'w11', x1: 620, y1: 650, x2: 1750, y2: 650, thickness: 8, acousticDamping: 0.70, label: 'Auditorium Partition' },
  ],
  furniture: [
    { id: 'f0', type: 'desk', x: 670, y: 110, width: 140, height: 50, label: 'Reception Concierge Desk', blocksSound: false },
    { id: 'f1', type: 'desk', x: 220, y: 190, width: 220, height: 90, label: 'Executive Board Table', blocksSound: false },
    { id: 'f2', type: 'desk', x: 700, y: 280, width: 140, height: 70, label: 'Frontend Team Pod', blocksSound: false },
    { id: 'f3', type: 'desk', x: 700, y: 400, width: 140, height: 70, label: 'Backend Team Pod', blocksSound: false },
    { id: 'f4', type: 'desk', x: 940, y: 150, width: 140, height: 70, label: 'AI/ML Team Pod', blocksSound: false },
    { id: 'f5', type: 'desk', x: 940, y: 280, width: 140, height: 70, label: 'DevOps & Cloud Pod', blocksSound: false },
    { id: 'f6', type: 'desk', x: 1140, y: 150, width: 120, height: 70, label: 'QA / Testing Pod', blocksSound: false },
    { id: 'f7', type: 'desk', x: 1140, y: 280, width: 120, height: 70, label: 'Product & Design Pod', blocksSound: false },
    { id: 'f8', type: 'watercooler', x: 1400, y: 120, width: 40, height: 40, label: 'Watercooler Hub', blocksSound: false },
    { id: 'f9', type: 'sofa', x: 1520, y: 250, width: 160, height: 60, label: 'Cafeteria Lounge Sofa', blocksSound: false },
    { id: 'f10', type: 'desk', x: 120, y: 650, width: 100, height: 60, label: 'Focus Desk A', blocksSound: false },
    { id: 'f11', type: 'desk', x: 380, y: 650, width: 100, height: 60, label: 'Focus Desk B', blocksSound: false },
    { id: 'f12', type: 'sofa', x: 1100, y: 730, width: 260, height: 50, label: 'Presentation Stage', blocksSound: false },
    { id: 'f13', type: 'sofa', x: 950, y: 840, width: 560, height: 45, label: 'Auditorium Front Row', blocksSound: false },
    { id: 'f14', type: 'sofa', x: 920, y: 920, width: 620, height: 45, label: 'Auditorium Second Row', blocksSound: false },
    { id: 'f15', type: 'plant', x: 580, y: 60, width: 36, height: 36, label: 'Entrance Palm', blocksSound: false },
    { id: 'f16', type: 'plant', x: 840, y: 60, width: 36, height: 36, label: 'Foyer Ficus', blocksSound: false },
    { id: 'f17', type: 'plant', x: 70, y: 60, width: 36, height: 36, label: 'Boardroom Monstera', blocksSound: false },
    { id: 'f18', type: 'plant', x: 1700, y: 60, width: 36, height: 36, label: 'Breakroom Fern', blocksSound: false },
  ],
};

export class OfficeWorld {
  /**
   * Creates an OfficeWorld renderer with room data or fallback layout definitions
   * @param {Object} [roomData]
   */
  constructor(roomData) {
    this.setRoomData(roomData);
  }

  /**
   * Updates the active room data layout
   * @param {Object} roomData
   */
  setRoomData(roomData) {
    if (roomData && typeof roomData === 'object') {
      this.roomData = {
        dimensions: roomData.dimensions || DEFAULT_OFFICE_LAYOUT.dimensions,
        zones: Array.isArray(roomData.zones) && roomData.zones.length > 0 ? roomData.zones : DEFAULT_OFFICE_LAYOUT.zones,
        walls: Array.isArray(roomData.walls) && roomData.walls.length > 0 ? roomData.walls : DEFAULT_OFFICE_LAYOUT.walls,
        furniture: Array.isArray(roomData.furniture) && roomData.furniture.length > 0 ? roomData.furniture : DEFAULT_OFFICE_LAYOUT.furniture,
        ...roomData,
      };
    } else {
      this.roomData = DEFAULT_OFFICE_LAYOUT;
    }
  }

  /**
   * Renders the complete virtual office environment
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   * @param {number} [time=0]
   * @param {{x: number, y: number}|null} [targetWaypoint=null]
   */
  render(ctx, width, height, time = 0, targetWaypoint = null) {
    if (!ctx) return;

    const renderWidth = Number(width) || this.roomData?.dimensions?.width || 1800;
    const renderHeight = Number(height) || this.roomData?.dimensions?.height || 1100;

    this.renderBuildingShell(ctx, renderWidth, renderHeight);
    this.renderFloorGrid(ctx, renderWidth, renderHeight);
    this.renderZones(ctx);
    this.renderFurniture(ctx, time);
    this.renderWalls(ctx);

    if (targetWaypoint && Number.isFinite(targetWaypoint.x) && Number.isFinite(targetWaypoint.y)) {
      this.renderWaypoint(ctx, targetWaypoint.x, targetWaypoint.y, time);
    }
  }

  /**
   * Renders the building perimeter structural shell and entrance doorway
   */
  renderBuildingShell(ctx, width, height) {
    ctx.save();

    ctx.fillStyle = '#0b1120';
    ctx.beginPath();
    ctx.roundRect(30, 30, width - 60, height - 60, 16);
    ctx.fill();

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(640, 20, 140, 20);

    ctx.font = 'bold 10px "Outfit", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚪 INFOTACT HQ ENTRANCE', 710, 30);

    ctx.restore();
  }

  /**
   * Renders the architectural background grid and alignment accents
   */
  renderFloorGrid(ctx, width, height) {
    const gridSize = 40;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 60; x < width; x += 120) {
      for (let y = 60; y < height; y += 120) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Renders designated office zones and area title plaques
   */
  renderZones(ctx) {
    const zones = Array.isArray(this.roomData?.zones) ? this.roomData.zones : [];
    ctx.save();

    for (const zone of zones) {
      if (!zone || !Array.isArray(zone.boundingBox) || zone.boundingBox.length < 2) continue;
      const [p1, p2] = zone.boundingBox;
      if (!Array.isArray(p1) || !Array.isArray(p2)) continue;

      const [x1, y1] = p1;
      const [x2, y2] = p2;
      const w = x2 - x1;
      const h = y2 - y1;
      if (w <= 0 || h <= 0) continue;

      ctx.fillStyle = zone.color || 'rgba(59, 130, 246, 0.06)';
      ctx.beginPath();
      ctx.roundRect(x1, y1, w, h, 12);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 12px "Outfit", sans-serif';
      const zoneTitle = (zone.name || 'Zone').toUpperCase();
      const titleWidth = ctx.measureText(zoneTitle).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(x1 + 16, y1 + 14, titleWidth + 30, 24, 6);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(zoneTitle, x1 + 26, y1 + 26);

      if (zone.isQuietZone) {
        ctx.font = '10px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#a78bfa';
        ctx.fillText('🤫 Quiet Zone', x1 + 26, y1 + 46);
      }
    }

    ctx.restore();
  }

  /**
   * Renders acoustic partition walls with sound-damping visual indicators
   */
  renderWalls(ctx) {
    const walls = Array.isArray(this.roomData?.walls) ? this.roomData.walls : [];
    ctx.save();

    for (const wall of walls) {
      if (!wall || typeof wall !== 'object') continue;
      const x1 = Number(wall.x1);
      const y1 = Number(wall.y1);
      const x2 = Number(wall.x2);
      const y2 = Number(wall.y2);

      if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = (wall.thickness || 10) + 4;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = wall.acousticDamping >= 0.9 ? '#6366f1' : '#0284c7';
      ctx.lineWidth = wall.thickness || 10;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  /**
   * Renders office desks, watercoolers, sofas, and plants
   */
  renderFurniture(ctx, time = 0) {
    const furniture = Array.isArray(this.roomData?.furniture) ? this.roomData.furniture : [];
    ctx.save();

    for (const item of furniture) {
      if (!item || typeof item !== 'object') continue;
      const x = Number(item.x);
      const y = Number(item.y);
      const width = Number(item.width) || 40;
      const height = Number(item.height) || 40;
      const { type, label } = item;

      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      if (type === 'desk') {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 8);
        ctx.fill();
        ctx.stroke();

        const monitorWidth = Math.min(36, width * 0.28);
        const monitorHeight = 6;
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(x + width * 0.2, y + height * 0.3, monitorWidth, monitorHeight);
        ctx.fillRect(x + width * 0.55, y + height * 0.3, monitorWidth, monitorHeight);

        if (label) {
          ctx.font = '10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#64748b';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x + width / 2, y + height / 2 + 10);
        }
      } else if (type === 'watercooler') {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(x, y + 10, width, height - 10, 6);
        ctx.fill();

        const bubbleOffset = Math.sin(time * 0.005) * 2;
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + 10 + bubbleOffset, width / 2 - 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Watercooler', x + width / 2, y + height + 4);
      } else if (type === 'sofa') {
        ctx.fillStyle = 'rgba(71, 85, 105, 0.7)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.fill();
        ctx.stroke();

        if (label) {
          ctx.font = '10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x + width / 2, y + height / 2);
        }
      } else if (type === 'plant') {
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Renders the animated destination waypoint beacon
   */
  renderWaypoint(ctx, x, y, time = 0) {
    if (!ctx || !Number.isFinite(x) || !Number.isFinite(y)) return;

    ctx.save();
    const progress = (time * 0.003) % 1;
    const ringRadius = 6 + progress * 20;
    const alpha = Math.max(0, 1 - progress);

    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    ctx.restore();
  }
}

export default OfficeWorld;
