/**
 * OfficeWorld: 2D Canvas Virtual Environment Renderer
 * Renders floor grids, zones, acoustic walls, desks, watercoolers, plants, and waypoints
 */

export class OfficeWorld {
  constructor(roomData) {
    this.roomData = roomData || {
      dimensions: { width: 1800, height: 1100 },
      zones: [],
      walls: [],
      furniture: [],
    };
  }

  setRoomData(roomData) {
    this.roomData = roomData;
  }

  render(ctx, width, height, time = 0, targetWaypoint = null) {
    // 1. Draw Building Floor Slab & Exterior Shell
    this.renderBuildingShell(ctx, width, height);

    // 2. Draw Architectural Floor Grid
    this.renderFloorGrid(ctx, width, height);

    // 3. Draw Office Zones
    this.renderZones(ctx);

    // 4. Draw Furniture & Obstacles
    this.renderFurniture(ctx, time);

    // 5. Draw Acoustic Partition Walls
    this.renderWalls(ctx);

    // 6. Draw Target Waypoint (if moving to click)
    if (targetWaypoint) {
      this.renderWaypoint(ctx, targetWaypoint.x, targetWaypoint.y, time);
    }
  }

  renderBuildingShell(ctx, width, height) {
    ctx.save();
    // Office Floor Plate
    ctx.fillStyle = '#0b1120';
    ctx.beginPath();
    ctx.roundRect(30, 30, width - 60, height - 60, 16);
    ctx.fill();

    // Exterior Perimeter Structural Walls
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Main Entrance Header / Doorway at Top (x: 640 to 760)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(640, 20, 140, 20);

    ctx.font = 'bold 10px "Outfit", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText('🚪 INFOTACT HQ ENTRANCE', 710, 34);

    ctx.restore();
  }

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

    // Modern dot matrix accent points every 120px
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

  renderZones(ctx) {
    const zones = this.roomData.zones || [];
    ctx.save();

    for (const zone of zones) {
      const [[x1, y1], [x2, y2]] = zone.boundingBox;
      const w = x2 - x1;
      const h = y2 - y1;

      // Zone background fill
      ctx.fillStyle = zone.color || 'rgba(59, 130, 246, 0.06)';
      ctx.beginPath();
      ctx.roundRect(x1, y1, w, h, 12);
      ctx.fill();

      // Zone border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Zone Title Header Plaque
      ctx.font = 'bold 12px "Outfit", sans-serif';
      const zoneTitle = zone.name.toUpperCase();
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

  renderWalls(ctx) {
    const walls = this.roomData.walls || [];
    ctx.save();

    for (const wall of walls) {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);

      // Acoustic partition wall aesthetics (cyan-tinted structural core with dark outline)
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = (wall.thickness || 10) + 4;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.strokeStyle = wall.acousticDamping >= 0.9 ? '#6366f1' : '#0284c7';
      ctx.lineWidth = wall.thickness || 10;
      ctx.stroke();

      // Acoustic insulation stripe
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  renderFurniture(ctx, time = 0) {
    const furniture = this.roomData.furniture || [];
    ctx.save();

    for (const item of furniture) {
      const { x, y, width, height, type, label } = item;

      if (type === 'desk') {
        // Modern wooden / graphite desk surface
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 8);
        ctx.fill();
        ctx.stroke();

        // Dual computer monitors on desk
        const monitorWidth = Math.min(36, width * 0.28);
        const monitorHeight = 6;
        ctx.fillStyle = '#0284c7'; // glowing screen
        ctx.fillRect(x + width * 0.2, y + height * 0.3, monitorWidth, monitorHeight);
        ctx.fillRect(x + width * 0.55, y + height * 0.3, monitorWidth, monitorHeight);

        // Desk label
        if (label) {
          ctx.font = '10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#64748b';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x + width / 2, y + height / 2 + 10);
        }
      } else if (type === 'watercooler') {
        // Watercooler base
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(x, y + 10, width, height - 10, 6);
        ctx.fill();

        // Water bottle (cyan with animated bubbles)
        const bubbleOffset = Math.sin(time * 0.005) * 2;
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + 10 + bubbleOffset, width / 2 - 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('Watercooler', x + width / 2, y + height + 12);
      } else if (type === 'sofa') {
        // Lounge sofa
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
        // Plant pot
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
        ctx.fill();

        // Leaves (green rosette)
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  renderWaypoint(ctx, x, y, time) {
    ctx.save();
    const progress = (time * 0.003) % 1;
    const ringRadius = 6 + progress * 20;
    const alpha = 1 - progress;

    // Expanding beacon ring
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center target marker
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    ctx.restore();
  }
}

export default OfficeWorld;
