export class DashboardCanvas {
  render(ctx, {
    width,
    height,
    userPos = { x: 150, y: 150 },
    profile = { name: 'You', avatarIcon: '👨‍💻', color: '#2F80ED' },
    colleagues = [],
    hearingRadius = 100,
    time = 0,
  }) {
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    this.renderGrid(ctx, width, height);
    this.renderRadarRings(ctx, userPos.x, userPos.y, hearingRadius, time);

    for (const c of colleagues) {
      const dist = Math.hypot(c.x - userPos.x, c.y - userPos.y);
      const inEarshot = dist <= hearingRadius;
      this.renderPeer(ctx, c.x, c.y, c.name, c.color, inEarshot, c.isSpeaking, time);
    }

    this.renderLocalAvatar(ctx, userPos.x, userPos.y, profile, time);
  }

  renderGrid(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;

    const step = 30;
    for (let x = 0; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderRadarRings(ctx, cx, cy, radius, time) {
    ctx.save();

    const pulse = Math.sin(time * 0.003) * 4;
    const currentR = Math.max(10, radius + pulse);

    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, currentR);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
    grad.addColorStop(0.7, 'rgba(14, 165, 233, 0.08)');
    grad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');

    ctx.beginPath();
    ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, currentR * 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('100px Earshot Range', cx, cy - currentR - 6);

    ctx.restore();
  }

  renderLocalAvatar(ctx, x, y, profile, time) {
    const radius = 22;

    ctx.save();

    const aura = Math.sin(time * 0.005) * 4;
    ctx.beginPath();
    ctx.arc(x, y, radius + 4 + aura, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = profile.color || '#2F80ED';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(profile.avatarIcon || '👨‍💻', x, y);

    const nameText = `${profile.name || 'You'} (You)`;
    ctx.font = 'bold 11px Inter, sans-serif';
    const textW = ctx.measureText(nameText).width;
    const tagH = 18;
    const tagY = y + radius + 7;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    this.roundRect(ctx, x - textW / 2 - 8, tagY, textW + 16, tagH, 5);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(nameText, x, tagY + tagH / 2);

    ctx.restore();
  }

  renderPeer(ctx, x, y, name, color, inEarshot, isSpeaking, time) {
    const radius = 16;

    ctx.save();

    if (isSpeaking && inEarshot) {
      const progress = (time * 0.0025) % 1;
      const rippleR = radius + progress * 20;
      ctx.beginPath();
      ctx.arc(x, y, rippleR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(16, 185, 129, ${1 - progress})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color || '#8B5CF6';
    ctx.fill();

    ctx.strokeStyle = inEarshot ? '#10B981' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name ? name[0] : 'P', x, y);

    const badgeText = inEarshot ? `${name} (Audio Active)` : `${name} (Muted)`;
    ctx.font = '500 10px Inter, sans-serif';
    const bW = ctx.measureText(badgeText).width;
    const tagH = 16;
    const tagY = y + radius + 6;

    ctx.fillStyle = inEarshot ? 'rgba(6, 78, 59, 0.9)' : 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    this.roundRect(ctx, x - bW / 2 - 6, tagY, bW + 12, tagH, 4);
    ctx.fill();

    ctx.fillStyle = inEarshot ? '#A7F3D0' : '#94A3B8';
    ctx.fillText(badgeText, x, tagY + tagH / 2);

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

export default DashboardCanvas;
