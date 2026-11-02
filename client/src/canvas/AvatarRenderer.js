
/**
 * AvatarRenderer: Canvas renderer for local and remote ProxiSpeak avatars.
 * Draws avatar identity, movement direction, proximity, voice activity and status.
 */

const TAU = Math.PI * 2;
const DEFAULT_EARSHOT_RADIUS = 100;
const DEFAULT_AVATAR_COLOR = '#3b82f6';

function isFinitePoint(x, y) {
  return Number.isFinite(x) && Number.isFinite(y);
}

function safeText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class AvatarRenderer {
  static drawRoundRect(ctx, x, y, width, height, radius = 6) {
    if (
      !ctx ||
      !isFinitePoint(x, y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) return;

    const r = clamp(
      Number(radius) || 0,
      0,
      Math.min(width, height) / 2
    );

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

  static drawEarshotHalo(
    ctx,
    x,
    y,
    earshotRadius = DEFAULT_EARSHOT_RADIUS,
    pulseTime = 0
  ) {
    if (!ctx || !isFinitePoint(x, y)) return;

    const radius = Math.max(
      10,
      Number(earshotRadius) || DEFAULT_EARSHOT_RADIUS
    );

    const time = Number.isFinite(pulseTime) ? pulseTime : 0;
    const currentRadius = Math.max(
      10,
      radius + Math.sin(time * 0.003) * 3
    );

    ctx.save();

    try {
      const gradient = ctx.createRadialGradient(
        x, y, 10, x, y, currentRadius
      );

      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
      gradient.addColorStop(0.7, 'rgba(6, 182, 212, 0.08)');
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.beginPath();
      ctx.arc(x, y, currentRadius, 0, TAU);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, currentRadius, 0, TAU);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      ctx.fillText(
        `🎧 ${Math.round(radius)}px Earshot Threshold`,
        x,
        y - currentRadius - 6
      );
    } finally {
      ctx.restore();
    }
  }

  static drawLocalPlayerBeacon(ctx, x, y, time = 0) {
    if (!ctx || !isFinitePoint(x, y)) return;

    const now = Number.isFinite(time) ? time : 0;

    ctx.save();

    try {
      const pulseRadius = 32 + Math.sin(now * 0.005) * 6;

      const spotlight = ctx.createRadialGradient(
        x, y, 5, x, y, pulseRadius
      );

      spotlight.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
      spotlight.addColorStop(0.6, 'rgba(234, 88, 12, 0.2)');
      spotlight.addColorStop(1, 'rgba(245, 158, 11, 0)');

      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, TAU);
      ctx.fillStyle = spotlight;
      ctx.fill();

      const beaconY = y - 52 + Math.sin(now * 0.006) * 5;
      const width = 112;
      const height = 24;
      const left = x - width / 2;
      const top = beaconY - height / 2;

      const gradient = ctx.createLinearGradient(
        left,
        top,
        left + width,
        top + height
      );

      gradient.addColorStop(0, '#f59e0b');
      gradient.addColorStop(1, '#ea580c');

      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 16;
      ctx.fillStyle = gradient;

      ctx.beginPath();
      this.drawRoundRect(ctx, left, top, width, height, 12);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = 'bold 10px "Outfit", sans-serif';
      ctx.fillStyle = '#fff';
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
    } finally {
      ctx.restore();
    }
  }

  static drawVoiceRipples(ctx, x, y, time = 0) {
    if (!ctx || !isFinitePoint(x, y)) return;

    const now = Number.isFinite(time) ? time : 0;

    ctx.save();

    try {
      for (let index = 0; index < 3; index += 1) {
        const progress =
          ((now * 0.002 + index / 3) % 1 + 1) % 1;

        const radius = 22 + progress * 42;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);

        ctx.strokeStyle =
          `rgba(16, 185, 129, ${(1 - progress) * 0.85})`;

        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    } finally {
      ctx.restore();
    }
  }

  static renderAvatar(
    ctx,
    avatar,
    isLocal = false,
    time = 0,
    earshotRadius = DEFAULT_EARSHOT_RADIUS
  ) {
    if (!ctx || !avatar || typeof avatar !== 'object') return;

    const x = Number(avatar.x ?? avatar.coordinates?.[0]);
    const y = Number(avatar.y ?? avatar.coordinates?.[1]);

    if (!isFinitePoint(x, y)) return;

    const username = safeText(avatar.username, 'User');
    const role = safeText(avatar.role, 'Engineer');

    const avatarColor = safeText(
      avatar.avatarColor,
      DEFAULT_AVATAR_COLOR
    );

    const facingAngle = Number.isFinite(avatar.facingAngle)
      ? avatar.facingAngle
      : 0;

    const speaking = Boolean(avatar.isSpeaking);
    const muted = Boolean(avatar.isMuted);
    const bot = Boolean(avatar.isBot);
    const now = Number.isFinite(time) ? time : 0;

    const radius = isLocal ? 24 : 18;

    ctx.save();

    try {
      if (isLocal) {
        this.drawEarshotHalo(ctx, x, y, earshotRadius, now);
        this.drawLocalPlayerBeacon(ctx, x, y, now);
      }

      if (speaking) {
        this.drawVoiceRipples(ctx, x, y, now);
      }

      if (isLocal) {
        ctx.save();

        try {
          const aura = 5 + Math.sin(now * 0.005) * 3;

          ctx.beginPath();
          ctx.arc(x, y, radius + aura, 0, TAU);

          ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 18;
          ctx.stroke();
        } finally {
          ctx.restore();
        }
      }

      ctx.shadowColor = isLocal
        ? 'rgba(245, 158, 11, 0.5)'
        : 'rgba(0, 0, 0, 0.45)';

      ctx.shadowBlur = isLocal ? 20 : 10;
      ctx.shadowOffsetY = 4;

      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, TAU);

      ctx.fillStyle = isLocal
        ? '#f59e0b'
        : speaking
          ? '#10b981'
          : 'rgba(255, 255, 255, 0.2)';

      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fillStyle = isLocal ? '#f59e0b' : avatarColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius - 2, 0, TAU);

      ctx.strokeStyle = isLocal
        ? '#fff'
        : 'rgba(255, 255, 255, 0.35)';

      ctx.lineWidth = isLocal ? 2.5 : 1.5;
      ctx.stroke();

      ctx.save();

      try {
        ctx.translate(x, y);
        ctx.rotate(facingAngle);

        ctx.beginPath();
        ctx.moveTo(radius + 2, 0);
        ctx.lineTo(radius + 11, -7);
        ctx.lineTo(radius + 11, 7);
        ctx.closePath();

        ctx.fillStyle = isLocal ? '#fef08a' : '#fff';
        ctx.fill();
      } finally {
        ctx.restore();
      }

      const initials = username
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'U';

      ctx.font = isLocal
        ? 'bold 14px "Outfit", sans-serif'
        : 'bold 11px "Outfit", sans-serif';

      ctx.fillStyle = isLocal ? '#000' : '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, x, y);

      const label = isLocal
        ? `⭐ ${username} (YOU)`
        : username;

      ctx.font = isLocal
        ? 'bold 12px "Plus Jakarta Sans", sans-serif'
        : '600 11px "Plus Jakarta Sans", sans-serif';

      const labelWidth = ctx.measureText(label).width;
      const labelHeight = isLocal ? 22 : 18;
      const labelY = y + radius + 8;
      const labelX = x - labelWidth / 2 - 10;

      ctx.fillStyle = isLocal
        ? 'rgba(15, 23, 42, 0.95)'
        : 'rgba(15, 23, 42, 0.85)';

      ctx.beginPath();
      this.drawRoundRect(
        ctx,
        labelX,
        labelY,
        labelWidth + 20,
        labelHeight,
        6
      );
      ctx.fill();

      ctx.strokeStyle = isLocal
        ? '#f59e0b'
        : 'rgba(255, 255, 255, 0.12)';

      ctx.lineWidth = isLocal ? 2 : 1;
      ctx.stroke();

      ctx.fillStyle = isLocal ? '#fef08a' : '#f8fafc';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, labelY + labelHeight / 2);

      ctx.font = isLocal
        ? 'bold 10px "Plus Jakarta Sans", sans-serif'
        : '9px "Plus Jakarta Sans", sans-serif';

      ctx.fillStyle = isLocal ? '#38bdf8' : '#94a3b8';

      ctx.fillText(
        isLocal ? `${role} (YOU)` : role,
        x,
        labelY + labelHeight + 9
      );

      if (muted) {
        ctx.beginPath();
        ctx.arc(x + radius, y - radius + 2, 8, 0, TAU);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('✕', x + radius, y - radius + 3);
      } else if (bot) {
        ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';

        ctx.beginPath();
        this.drawRoundRect(
          ctx,
          x - 14,
          y - radius - 12,
          28,
          12,
          3
        );
        ctx.fill();

        ctx.font = 'bold 7px "Outfit", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('BOT', x, y - radius - 6);
      }
    } finally {
      ctx.restore();
    }
  }
}

export default AvatarRenderer;
