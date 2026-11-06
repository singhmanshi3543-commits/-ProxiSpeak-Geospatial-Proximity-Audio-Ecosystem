import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const freshCutoff = () => new Date(Date.now() - env.LOCATION_MAX_AGE_SECONDS * 1000);

// Returns [lng, lat] if the user's last shared location is recent enough, else throws.
export function freshCoords(user) {
  const coords = user.location?.coordinates;
  const at = user.locationUpdatedAt;
  if (!coords || coords.length !== 2 || !at || at < freshCutoff()) {
    throw new AppError(409, 'Share a fresh location first', 'LOCATION_REQUIRED');
  }
  return [...coords];
}

const round5 = (m) => Math.round(m / 5) * 5; // coarse distance: limits trilateration of exact positions

export async function findNearbyUsers(me) {
  const coords = freshCoords(me);
  const rows = await User.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: coords },
        distanceField: 'distanceMeters',
        maxDistance: env.PROXIMITY_RADIUS_METERS,
        spherical: true,
        query: { _id: { $ne: me._id }, isDiscoverable: true, locationUpdatedAt: { $gte: freshCutoff() } },
      },
    },
    { $limit: 50 },
    { $project: { username: 1, displayName: 1, bio: 1, avatarColor: 1, distanceMeters: 1 } },
  ]);
  return rows.map((u) => ({
    id: u._id.toString(),
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    avatarColor: u.avatarColor,
    distanceMeters: round5(u.distanceMeters),
  }));
}

// Server-side authority on "are these two users within range right now?". Phase 4 signaling reuses this.
export async function isWithinProximity(me, otherUserId, { requireDiscoverable = false } = {}) {
  const coords = freshCoords(me);
  const query = { _id: new mongoose.Types.ObjectId(otherUserId), locationUpdatedAt: { $gte: freshCutoff() } };
  if (requireDiscoverable) query.isDiscoverable = true;
  const rows = await User.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: coords },
        distanceField: 'distanceMeters',
        maxDistance: env.PROXIMITY_RADIUS_METERS,
        spherical: true,
        query,
      },
    },
    { $limit: 1 },
    { $project: { _id: 1 } },
  ]);
  return rows.length > 0;
}
