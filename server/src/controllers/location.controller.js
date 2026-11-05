import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { haversineMeters } from '../utils/geo.js';
import { recordAudit } from '../services/audit.js';
import { evictOutOfRange } from '../services/rooms.js';
import { clearPresence } from '../services/presence.js';

const MAX_SPEED_MPS = 100; // ~360 km/h; faster than this between two updates is treated as spoofing/glitch
const MIN_JUMP_METERS = 500; // ignore speed check for small movements (GPS jitter)

export async function updateLocation(req, res) {
  const { lat, lng, accuracy } = req.body;
  const reject = async (code, message, reason) => {
    await recordAudit({ action: 'location.rejected', userId: req.user._id, req, meta: { reason } });
    throw new AppError(422, message, code);
  };

  if (accuracy != null && accuracy > env.MAX_ACCURACY_METERS) {
    await reject('LOW_ACCURACY', `Location accuracy is too poor (> ${env.MAX_ACCURACY_METERS} m)`, 'low_accuracy');
  }

  const prev = req.user.location?.coordinates;
  const prevAt = req.user.locationUpdatedAt;
  if (prev?.length === 2 && prevAt) {
    const dist = haversineMeters([...prev], [lng, lat]);
    const secs = Math.max((Date.now() - prevAt.getTime()) / 1000, 1);
    if (dist > MIN_JUMP_METERS && dist / secs > MAX_SPEED_MPS) {
      await reject('IMPLAUSIBLE_MOVEMENT', 'Location changed implausibly fast', 'speed');
    }
  }

  const now = new Date();
  await User.updateOne(
    { _id: req.user._id },
    {
      $set: {
        location: { type: 'Point', coordinates: [lng, lat] },
        locationAccuracy: accuracy ?? null,
        locationUpdatedAt: now,
      },
    }
  );
  const evictedRoomIds = await evictOutOfRange(req.user._id, [lng, lat], req);
  // Routine updates are intentionally not audit-logged (volume + privacy); rejections and room changes are.
  res.json({ updatedAt: now, evictedRoomIds });
}

export async function clearLocation(req, res) {
  await clearPresence(req.user._id, req);
  await recordAudit({ action: 'location.clear', userId: req.user._id, req });
  res.status(204).end();
}
