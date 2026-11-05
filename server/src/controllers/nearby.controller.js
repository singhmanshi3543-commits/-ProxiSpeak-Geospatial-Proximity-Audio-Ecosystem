import { env } from '../config/env.js';
import { findNearbyUsers } from '../services/proximity.js';

export async function nearbyUsers(req, res) {
  const users = await findNearbyUsers(req.user);
  res.json({ radiusMeters: env.PROXIMITY_RADIUS_METERS, users });
}
