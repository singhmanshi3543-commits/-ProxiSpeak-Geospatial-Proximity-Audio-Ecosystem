/**
 * LandingCanvas: Canvas renderer for the ProxiSpeak landing-page mini office.
 * Draws the interactive proximity demo (floor, desks, hearing halo, avatars).
 * Separate from OfficeWorld.js (live office map) and AvatarRenderer.js (full office avatars).
 */

export class LandingCanvas {
  render(ctx, {
    width,
    height,
    roomWidth,
    roomHeight,
    userPos,
    teammates = [],
    hearingRadius,
    time = 0,
  }) {
    const sx = width / roomWidth;
    const sy = height / roomHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    this.renderFloorGrid(ctx, width, height);
    this.renderFurniture(ctx, width, height, sx, sy);
    this.renderHearingHalo(ctx, userPos.x * sx, userPos.y * sy, hearingRadius * sx, time);

    for (const teammate of teammates) {
      this.renderAvatar(ctx, {
        x: teammate.x * sx,
        y: teammate.y * sy,
        name: teammate.name,
        color: teammate.avatarColor,
        isLocal: false,
        isSpeaking: teammate.status === 'speaking',
        time,
      });
    }

    this.renderAvatar(ctx, {
      x: userPos.x * sx,
      y: userPos.y * sy,
      name: 'You',
      color: '#2F80ED',
      isLocal: true,
      isSpeaking: false,
      time,
    });
  }

  renderFloorGrid(ctx, width, height) {
    const gridSize = 29;
    ctx.save();
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.55)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderFurniture(ctx, width, height, sx, sy) {
    this.renderDesk(ctx, 24 * sx, 24 * sy, 80 * sx, 40 * sy, 'Desk A');
    this.renderDesk(ctx, 24 * sx, height - 64 * sy, 80 * sx, 40 * sy, 'Desk B');

    const podW = 96 * sx;
    const podH = 128 * sy;
    const podX = width - podW - 32 * sx;
    const podY = (height - podH) / 2;

    ctx.save();
    this.roundRect(ctx, podX, podY, podW, podH, 10);
    ctx.fillStyle = 'rgba(234, 242, 253, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(47, 128, 237, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#1F3A5F';
    ctx.font = `600 ${Math.max(10, 11 * sx)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Meeting Pod', podX + podW / 2, podY + podH / 2 - 10 * sy);
    ctx.font = `${Math.max(14, 16 * sx)}px sans-serif`;
    ctx.fillText('☕', podX + podW / 2, podY + podH / 2 + 14 * sy);
    ctx.restore();
  }

  renderDesk(ctx, x, y, w, h, label) {
    ctx.save();
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#6B7280';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();
  }

  renderHearingHalo(ctx, x, y, radius, time) {
    const pulse = Math.sin(time * 0.003) * 3;
    const r = Math.max(8, radius + pulse);

    ctx.save();
    const grad = ctx.createRadialGradient(x, y, 8, x, y, r);
    grad.addColorStop(0, 'rgba(47, 128, 237, 0.18)');
    grad.addColorStop(1, 'rgba(47, 128, 237, 0.0)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(47, 128, 237, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  renderAvatar(ctx, { x, y, name, color, isLocal, isSpeaking, time }) {
    const radius = isLocal ? 18 : 16;

    ctx.save();

    if (isSpeaking) {
      const progress = (time * 0.002) % 1;
      const waveR = radius + 8 + progress * 16;
      ctx.beginPath();
      ctx.arc(x, y, waveR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(242, 153, 74, ${1 - progress})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${isLocal ? 10 : 12}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isLocal ? 'You' : name[0], x, y);

    const tag = isLocal ? 'Your Avatar' : name;
    ctx.font = `600 11px Inter, sans-serif`;
    const tagWidth = ctx.measureText(tag).width;
    const tagX = x - tagWidth / 2 - 6;
    const tagY = y + radius + 8;
    this.roundRect(ctx, tagX, tagY, tagWidth + 12, 16, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fill();
    ctx.fillStyle = isLocal ? '#2F80ED' : '#1F3A5F';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, x, tagY + 8);

    ctx.restore();
  }

  roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

export default LandingCanvas;
