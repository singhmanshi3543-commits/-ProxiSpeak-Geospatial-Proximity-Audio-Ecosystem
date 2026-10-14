export class AvatarRenderer {
  static drawEarshotHalo(ctx, x, y, earshotRadius = 100, pulseTime = 0) {
    ctx.save();

    const pulseDelta = Math.sin(pulseTime * 0.003) * 3;
    const currentRadius = earshotRadius + pulseDelta;

    const grad = ctx.createRadialGradient(x, y, 10, x, y, currentRadius);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
    grad.addColorStop(0.7, 'rgba(6, 182, 212, 0.08)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.95)';
    ctx.textAlign = 'center';
    ctx.fillText('🎧 100px Earshot Threshold', x, y - currentRadius - 6);

    ctx.restore();
  }

  static drawLocalPlayerBeacon(ctx, x, y, time = 0) {
    ctx.save();

    const pulseRadius = 32 + Math.sin(time * 0.005) * 6;
    const spotGrad = ctx.createRadialGradient(x, y, 5, x, y, pulseRadius);
    spotGrad.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
    spotGrad.addColorStop(0.6, 'rgba(234, 88, 12, 0.2)');
    spotGrad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

    ctx.beginPath();
    ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = spotGrad;
    ctx.fill();

    const bounce = Math.sin(time * 0.006) * 5;
    const beaconY = y - 52 + bounce;

    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 16;

    const pillWidth = 84;
    const pillHeight = 24;
    const pillX = x - pillWidth / 2;
    const pillY = beaconY - pillHeight / 2;

    const grad = ctx.createLinearGradient(pillX, pillY, pillX + pillWidth, pillY + pillHeight);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(1, '#ea580c');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 12);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📍 YOU ARE HERE', x, beaconY);

    ctx.beginPath();
    ctx.moveTo(x - 6, beaconY + 12);
    ctx.lineTo(x + 6, beaconY + 12);
    ctx.lineTo(x, beaconY + 19);
    ctx.closePath();
    ctx.fillStyle = '#ea580c';
    ctx.fill();

    ctx.restore();
  }

  static drawVoiceRipples(ctx, x, y, time) {
    ctx.save();
    const waveCount = 3;
    for (let i = 0; i < waveCount; i++) {
      const progress = ((time * 0.002 + i * (1 / waveCount)) % 1);
      const radius = 22 + progress * 42;
      const alpha = (1 - progress) * 0.85;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  static renderAvatar(ctx, avatar, isLocal = false, time = 0, earshotRadius = 100) {
    const {
      x,
      y,
      username = 'User',
      role = 'Engineer',
      avatarColor = '#3b82f6',
      facingAngle = 0,
      isSpeaking = false,
      isMuted = false,
      isBot = false,
    } = avatar;

    const avatarRadius = isLocal ? 24 : 18;

    ctx.save();

    if (isLocal) {
      this.drawEarshotHalo(ctx, x, y, earshotRadius, time);
      this.drawLocalPlayerBeacon(ctx, x, y, time);
    }

    if (isSpeaking) {
      this.drawVoiceRipples(ctx, x, y, time);
    }

    if (isLocal) {
      ctx.save();
      const pulseAura = 5 + Math.sin(time * 0.005) * 3;
      ctx.beginPath();
      ctx.arc(x, y, avatarRadius + pulseAura, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();
    }

    ctx.shadowColor = isLocal ? 'rgba(245, 158, 11, 0.5)' : 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = isLocal ? 20 : 10;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.arc(x, y, avatarRadius + 4, 0, Math.PI * 2);
    ctx.fillStyle = isLocal ? '#f59e0b' : isSpeaking ? '#10b981' : 'rgba(255, 255, 255, 0.2)';
    ctx.fill();

    ctx.shadowColor = 'transparent';

    ctx.beginPath();
    ctx.arc(x, y, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = isLocal ? '#f59e0b' : avatarColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, avatarRadius - 2, 0, Math.PI * 2);
    ctx.strokeStyle = isLocal ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = isLocal ? 2.5 : 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facingAngle);

    ctx.beginPath();
    ctx.moveTo(avatarRadius + 2, 0);
    ctx.lineTo(avatarRadius + 11, -7);
    ctx.lineTo(avatarRadius + 11, 7);
    ctx.closePath();
    ctx.fillStyle = isLocal ? '#fef08a' : '#ffffff';
    ctx.fill();
    ctx.restore();

    const initials = username
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    ctx.font = isLocal ? 'bold 14px "Outfit", sans-serif' : 'bold 11px "Outfit", sans-serif';
    ctx.fillStyle = isLocal ? '#000000' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, x, y);

    const tagText = isLocal ? `⭐ ${username} (YOU)` : username;
    ctx.font = isLocal ? 'bold 12px "Plus Jakarta Sans", sans-serif' : '600 11px "Plus Jakarta Sans", sans-serif';
    const textWidth = ctx.measureText(tagText).width;
    const tagHeight = isLocal ? 22 : 18;
    const tagY = y + avatarRadius + 8;

    ctx.fillStyle = isLocal ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x - textWidth / 2 - 10, tagY, textWidth + 20, tagHeight, 6);
    ctx.fill();

    ctx.strokeStyle = isLocal ? '#f59e0b' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = isLocal ? 2 : 1;
    ctx.stroke();

    ctx.fillStyle = isLocal ? '#fef08a' : '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, x, tagY + tagHeight / 2);

    ctx.font = isLocal ? 'bold 10px "Plus Jakarta Sans", sans-serif' : '9px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = isLocal ? '#38bdf8' : '#94a3b8';
    ctx.fillText(isLocal ? `${role} (YOU)` : role, x, tagY + tagHeight + 9);

    if (isMuted) {
      ctx.beginPath();
      ctx.arc(x + avatarRadius, y - avatarRadius + 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('✕', x + avatarRadius, y - avatarRadius + 3);
    } else if (isBot) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
      ctx.beginPath();
      ctx.roundRect(x - 14, y - avatarRadius - 12, 28, 12, 3);
      ctx.fill();
      ctx.font = 'bold 7px "Outfit", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('BOT', x, y - avatarRadius - 6);
    }

    ctx.restore();
  }
}

export default AvatarRenderer;
