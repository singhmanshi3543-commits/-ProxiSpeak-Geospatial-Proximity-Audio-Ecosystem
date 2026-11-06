import mongoose from 'mongoose';
import { Room } from '../models/Room.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { MONGO_EARTH_RADIUS_M } from '../utils/geo.js';
import { recordAudit } from './audit.js';
import { freshCoords } from './proximity.js';

const PUBLIC_USER_FIELDS = 'username displayName avatarColor';

export function toRoomDto(room) {
  return {
    id: room._id.toString(),
    name: room.name,
    hostId: room.host.toString(),
    maxParticipants: room.maxParticipants,
    participants: room.participants.map((p) => ({
      id: (p.user._id ?? p.user).toString(),
      username: p.user.username,
      displayName: p.user.displayName,
      avatarColor: p.user.avatarColor,
      joinedAt: p.joinedAt,
    })),
    createdAt: room.createdAt,
  };
}

async function assertNotInRoom(userId) {
  if (await Room.exists({ isActive: true, 'participants.user': userId })) {
    throw new AppError(409, 'Leave your current room first', 'ALREADY_IN_ROOM');
  }
}

export async function createRoom(user, { name, maxParticipants }, req) {
  await assertNotInRoom(user._id);
  const coords = freshCoords(user);
  const room = await Room.create({
    name,
    host: user._id,
    maxParticipants: maxParticipants ?? env.ROOM_MAX_PARTICIPANTS,
    anchor: { type: 'Point', coordinates: coords },
    participants: [{ user: user._id }],
  });
  await recordAudit({ action: 'room.create', userId: user._id, req, meta: { roomId: room._id.toString() } });
  await room.populate('participants.user', PUBLIC_USER_FIELDS);
  return toRoomDto(room);
}

export async function listNearbyRooms(user) {
  const coords = freshCoords(user);
  const rows = await Room.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: coords },
        key: 'anchor',
        distanceField: 'distanceMeters',
        maxDistance: env.PROXIMITY_RADIUS_METERS,
        spherical: true,
        query: { isActive: true },
      },
    },
    { $limit: 50 },
    {
      $project: {
        name: 1, maxParticipants: 1, distanceMeters: 1,
        participantCount: { $size: '$participants' },
        isMember: { $in: [user._id, '$participants.user'] },
      },
    },
  ]);
  return rows.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    maxParticipants: r.maxParticipants,
    participantCount: r.participantCount,
    isMember: r.isMember,
    distanceMeters: Math.round(r.distanceMeters / 5) * 5,
  }));
}

export async function joinRoom(user, roomId, req) {
  await assertNotInRoom(user._id);
  const coords = freshCoords(user);
  const id = new mongoose.Types.ObjectId(roomId);

  // Distance is decided by MongoDB against the room's stored anchor, never by client input.
  const inRange = await Room.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: coords },
        key: 'anchor',
        distanceField: 'distanceMeters',
        maxDistance: env.PROXIMITY_RADIUS_METERS,
        spherical: true,
        query: { _id: id, isActive: true },
      },
    },
    { $limit: 1 },
    { $project: { _id: 1 } },
  ]);

  if (inRange.length === 0) {
    const exists = await Room.exists({ _id: id, isActive: true });
    if (!exists) throw new AppError(404, 'Room not found', 'ROOM_NOT_FOUND');
    await recordAudit({ action: 'room.join.denied', userId: user._id, req, meta: { roomId, reason: 'out_of_range' } });
    throw new AppError(403, `You must be within ${env.PROXIMITY_RADIUS_METERS} m of this room`, 'OUT_OF_RANGE');
  }

  // Atomic: capacity check and push happen in one operation, so concurrent joins cannot overfill.
  const updated = await Room.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
      'participants.user': { $ne: user._id },
      $expr: { $lt: [{ $size: '$participants' }, '$maxParticipants'] },
    },
    { $push: { participants: { user: user._id } } },
    { new: true }
  );
  if (!updated) {
    await recordAudit({ action: 'room.join.denied', userId: user._id, req, meta: { roomId, reason: 'full_or_closed' } });
    throw new AppError(409, 'Room is full or no longer active', 'ROOM_FULL');
  }
  await recordAudit({ action: 'room.join', userId: user._id, req, meta: { roomId } });
  await updated.populate('participants.user', PUBLIC_USER_FIELDS);
  return toRoomDto(updated);
}

export async function leaveRoom(userId, roomId, req, action = 'room.leave') {
  const room = await Room.findOneAndUpdate(
    { _id: roomId, isActive: true, 'participants.user': userId },
    { $pull: { participants: { user: userId } } },
    { new: true }
  );
  if (!room) throw new AppError(404, 'You are not in this room', 'NOT_IN_ROOM');

  if (room.participants.length === 0) {
    await Room.updateOne({ _id: room._id }, { $set: { isActive: false } });
  } else if (room.host.equals(userId)) {
    await Room.updateOne({ _id: room._id }, { $set: { host: room.participants[0].user } });
  }
  await recordAudit({ action, userId, req, meta: { roomId: room._id.toString() } });
  return room._id.toString();
}

export async function leaveAllRooms(userId, req) {
  const rooms = await Room.find({ isActive: true, 'participants.user': userId }).select('_id');
  for (const r of rooms) {
    await leaveRoom(userId, r._id, req).catch(() => {});
  }
}

// After a location update: drop the user from any room whose anchor is now out of range.
export async function evictOutOfRange(userId, coords, req) {
  const rooms = await Room.find({
    isActive: true,
    'participants.user': userId,
    anchor: { $not: { $geoWithin: { $centerSphere: [coords, env.PROXIMITY_RADIUS_METERS / MONGO_EARTH_RADIUS_M] } } },
  }).select('_id');
  const evicted = [];
  for (const r of rooms) {
    try {
      evicted.push(await leaveRoom(userId, r._id, req, 'room.evicted'));
    } catch { /* already left */ }
  }
  return evicted;
}
