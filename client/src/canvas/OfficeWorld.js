
const normalizePoint = (point) => {
  if (Array.isArray(point) && point.length >= 2) {
    const x = Number(point[0]);
    const y = Number(point[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  if (point && typeof point === 'object') {
    const x = Number(point.x ?? point.coordinates?.[0]);
    const y = Number(point.y ?? point.coordinates?.[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  return null;
};

const safeDimension = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

export class OfficeWorld {
  static drawRoundRect(ctx, x, y, width, height, radius = 8) {
    if (!ctx || ![x, y, width, height, radius].every(Number.isFinite)) return;
    if (width <= 0 || height <= 0) return;

    const r = clamp(radius, 0, Math.min(width, height) / 2);

    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, width, height, r);
      return;
    }

    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  constructor(roomData = null) {
    this.setRoomData(roomData);
  }

  setRoomData(roomData = null) {
    const source = roomData && typeof roomData === 'object' ? roomData : {};
    const defaults = DEFAULT_OFFICE_LAYOUT;

    this.roomData = {
      ...defaults,
      ...source,
      dimensions: {
        width: safeDimension(
          source.dimensions?.width,
          defaults.dimensions.width
        ),
        height: safeDimension(
          source.dimensions?.height,
          defaults.dimensions.height
        ),
      },
      zones: Array.isArray(source.zones)
        ? source.zones
        : defaults.zones,
      walls: Array.isArray(source.walls)
        ? source.walls
        : defaults.walls,
      furniture: Array.isArray(source.furniture)
        ? source.furniture
        : defaults.furniture,
    };

    return this.roomData;
  }

  getZoneAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    return this.roomData.zones.find((zone) => {
      const bounds = zone?.boundingBox;
      if (!Array.isArray(bounds) || bounds.length < 2) return false;

      const first = normalizePoint(bounds[0]);
      const second = normalizePoint(bounds[1]);

      if (!first || !second) return false;

      const left = Math.min(first.x, second.x);
      const right = Math.max(first.x, second.x);
      const top = Math.min(first.y, second.y);
      const bottom = Math.max(first.y, second.y);

      return x >= left && x <= right && y >= top && y <= bottom;
    }) || null;
  }

  render(ctx, width, height, time = 0, targetWaypoint = null) {
    if (!ctx) return;

    const renderWidth = safeDimension(
      width,
      this.roomData.dimensions.width
    );

    const renderHeight = safeDimension(
      height,
      this.roomData.dimensions.height
    );

    const renderTime = Number.isFinite(time) ? time : 0;
    const waypoint = normalizePoint(targetWaypoint);

    ctx.save();

    try {
      this.renderBuildingShell(ctx, renderWidth, renderHeight);
      this.renderFloorGrid(ctx, renderWidth, renderHeight);
      this.renderZones(ctx);
      this.renderFurniture(ctx, renderTime);
      this.renderWalls(ctx);

      if (waypoint) {
        this.renderWaypoint(
          ctx,
          waypoint.x,
          waypoint.y,
          renderTime
        );
      }
    } finally {
      ctx.restore();
    }
  }

  renderBuildingShell(ctx, width, height) {
    if (!ctx || width <= 60 || height <= 60) return;

    ctx.save();

    try {
      ctx.fillStyle = '#0b1120';
      ctx.beginPath();

      OfficeWorld.drawRoundRect(
        ctx,
        30,
        30,
        width - 60,
        height - 60,
        16
      );

      ctx.fill();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3;
      ctx.stroke();

      const entranceWidth = Math.min(140, width - 80);
      const entranceX = (width - entranceWidth) / 2;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(entranceX, 20, entranceWidth, 20);

      ctx.font = 'bold 10px "Outfit", sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillText(
        '🚪 INFOTACT HQ ENTRANCE',
        width / 2,
        30
      );
    } finally {
      ctx.restore();
    }
  }

  renderFloorGrid(ctx, width, height) {
    if (!ctx || width <= 0 || height <= 0) return;

    const gridSize = 40;

    ctx.save();

    try {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;

      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }

      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }

      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.075)';

      for (let x = 60; x < width; x += 120) {
        for (let y = 60; y < height; y += 120) {
          ctx.moveTo(x + 1.5, y);
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        }
      }

      ctx.fill();
    } finally {
      ctx.restore();
    }
  }

  renderZones(ctx) {
    if (!ctx) return;

    ctx.save();

    try {
      for (const zone of this.roomData.zones) {
        const bounds = zone?.boundingBox;

        if (!Array.isArray(bounds) || bounds.length < 2) continue;

        const first = normalizePoint(bounds[0]);
        const second = normalizePoint(bounds[1]);

        if (!first || !second) continue;

        const x = Math.min(first.x, second.x);
        const y = Math.min(first.y, second.y);
        const width = Math.abs(second.x - first.x);
        const height = Math.abs(second.y - first.y);

        if (width <= 0 || height <= 0) continue;

        ctx.fillStyle =
          zone.color || 'rgba(59, 130, 246, 0.06)';

        ctx.beginPath();

        OfficeWorld.drawRoundRect(
          ctx,
          x,
          y,
          width,
          height,
          12
        );

        ctx.fill();

        ctx.strokeStyle = zone.isQuietZone
          ? 'rgba(167, 139, 250, 0.35)'
          : 'rgba(255, 255, 255, 0.08)';

        ctx.lineWidth = zone.isQuietZone ? 1.5 : 1;
        ctx.stroke();

        const title = String(zone.name || 'Zone').toUpperCase();

        ctx.font = 'bold 12px "Outfit", sans-serif';

        const titleWidth = ctx.measureText(title).width;
        const plaqueWidth = Math.min(width - 20, titleWidth + 24);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.beginPath();

        OfficeWorld.drawRoundRect(
          ctx,
          x + 10,
          y + 10,
          Math.max(0, plaqueWidth),
          24,
          6
        );

        ctx.fill();

        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        ctx.fillText(
          title,
          x + 20,
          y + 22,
          Math.max(0, plaqueWidth - 16)
        );

        if (zone.isQuietZone) {
          ctx.font = '10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#c4b5fd';
          ctx.fillText('🤫 Quiet Zone', x + 20, y + 46);
        }
      }
    } finally {
      ctx.restore();
    }
  }

  renderWalls(ctx) {
    if (!ctx) return;

    ctx.save();

    try {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const wall of this.roomData.walls) {
        if (!wall || typeof wall !== 'object') continue;

        const x1 = Number(wall.x1);
        const y1 = Number(wall.y1);
        const x2 = Number(wall.x2);
        const y2 = Number(wall.y2);

        if (![x1, y1, x2, y2].every(Number.isFinite)) continue;

        const thickness = clamp(
          Number(wall.thickness) || 10,
          2,
          40
        );

        const damping = clamp(
          Number(wall.acousticDamping) || 0,
          0,
          1
        );

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)';
        ctx.lineWidth = thickness + 5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        ctx.strokeStyle = damping >= 0.9
          ? '#818cf8'
          : damping >= 0.8
            ? '#0ea5e9'
            : '#0284c7';

        ctx.lineWidth = thickness;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = Math.max(1, thickness * 0.16);
        ctx.stroke();

        ctx.setLineDash([]);
      }
    } finally {
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  renderFurniture(ctx, time = 0) {
    if (!ctx) return;

    const now = Number.isFinite(time) ? time : 0;

    ctx.save();

    try {
      for (const item of this.roomData.furniture) {
        if (!item || typeof item !== 'object') continue;

        const x = Number(item.x);
        const y = Number(item.y);
        const width = safeDimension(item.width, 40);
        const height = safeDimension(item.height, 40);

        if (![x, y].every(Number.isFinite)) continue;

        switch (item.type) {
          case 'desk':
            this.renderDesk(ctx, item, x, y, width, height);
            break;

          case 'watercooler':
            this.renderWatercooler(
              ctx, item, x, y, width, height, now
            );
            break;

          case 'sofa':
            this.renderSofa(ctx, item, x, y, width, height);
            break;

          case 'plant':
            this.renderPlant(ctx, x, y, width, height);
            break;

          default:
            this.renderUnknownFurniture(
              ctx, item, x, y, width, height
            );
        }
      }
    } finally {
      ctx.restore();
    }
  }

  renderDesk(ctx, item, x, y, width, height) {
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();

    OfficeWorld.drawRoundRect(
      ctx, x, y, width, height, 8
    );

    ctx.fill();
    ctx.stroke();

    const monitorWidth = Math.min(36, width * 0.28);
    const monitorHeight = Math.max(
      4,
      Math.min(7, height * 0.12)
    );

    ctx.fillStyle = '#0284c7';

    ctx.fillRect(
      x + width * 0.2,
      y + height * 0.3,
      monitorWidth,
      monitorHeight
    );

    ctx.fillRect(
      x + width * 0.55,
      y + height * 0.3,
      monitorWidth,
      monitorHeight
    );

    this.renderFurnitureLabel(
      ctx,
      item.label,
      x + width / 2,
      y + height / 2 + 12
    );
  }

  renderWatercooler(ctx, item, x, y, width, height, time) {
    const topOffset = Math.min(10, height * 0.2);

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();

    OfficeWorld.drawRoundRect(
      ctx,
      x,
      y + topOffset,
      width,
      height - topOffset,
      6
    );

    ctx.fill();

    const bubbleOffset = Math.sin(time * 0.005) * 2;

    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();

    ctx.arc(
      x + width / 2,
      y + topOffset + bubbleOffset,
      Math.max(3, width / 2 - 4),
      0,
      Math.PI * 2
    );

    ctx.fill();

    this.renderFurnitureLabel(
      ctx,
      item.label || 'Watercooler',
      x + width / 2,
      y + height + 12,
      '#38bdf8'
    );
  }

  renderSofa(ctx, item, x, y, width, height) {
    ctx.fillStyle = 'rgba(71, 85, 105, 0.78)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;

    ctx.beginPath();

    OfficeWorld.drawRoundRect(
      ctx, x, y, width, height, 10
    );

    ctx.fill();
    ctx.stroke();

    if (width > 100) {
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y + 6);
      ctx.lineTo(x + width / 2, y + height - 6);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();
    }

    this.renderFurnitureLabel(
      ctx,
      item.label,
      x + width / 2,
      y + height / 2
    );
  }

  renderPlant(ctx, x, y, width, height) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.max(4, Math.min(width, height) / 2);

    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      Math.max(2, radius - 3),
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = 'rgba(167, 243, 208, 0.8)';
    ctx.beginPath();

    ctx.arc(
      centerX - radius * 0.25,
      centerY - radius * 0.25,
      Math.max(2, radius * 0.22),
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  renderUnknownFurniture(ctx, item, x, y, width, height) {
    ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.3)';

    ctx.beginPath();

    OfficeWorld.drawRoundRect(
      ctx, x, y, width, height, 6
    );

    ctx.fill();
    ctx.stroke();

    this.renderFurnitureLabel(
      ctx,
      item.label || item.type || 'Object',
      x + width / 2,
      y + height / 2
    );
  }

  renderFurnitureLabel(ctx, label, x, y, color = '#94a3b8') {
    if (!label) return;

    ctx.save();

    try {
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(label), x, y, 220);
    } finally {
      ctx.restore();
    }
  }

  renderWaypoint(ctx, x, y, time = 0) {
    if (!ctx || ![x, y].every(Number.isFinite)) return;

    const now = Number.isFinite(time) ? time : 0;
    const progress = ((now * 0.003) % 1 + 1) % 1;
    const ringRadius = 7 + progress * 22;
    const alpha = 1 - progress;

    ctx.save();

    try {
      const glow = ctx.createRadialGradient(
        x, y, 1, x, y, 26
      );

      glow.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#e0f2fe';
      ctx.fill();
    } finally {
      ctx.restore();
    }
  }
}

export default OfficeWorld;
