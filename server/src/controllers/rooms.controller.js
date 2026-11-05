import { Room } from '../models/Room.js';
import { AppError } from '../utils/AppError.js';
import * as rooms from '../services/rooms.js';

export async function create(req, res) {
  res.status(201).json({ room: await rooms.createRoom(req.user, req.body, req) });
}

export async function list(req, res) {
  res.json({ rooms: await rooms.listNearbyRooms(req.user) });
}

export async function get(req, res) {
  const room = await Room.findOne({ _id: req.params.id, isActive: true, 'participants.user': req.user._id })
    .populate('participants.user', 'username displayName avatarColor');
  if (!room) throw new AppError(404, 'Room not found or you are not a member', 'ROOM_NOT_FOUND');
  res.json({ room: rooms.toRoomDto(room) });
}

export async function join(req, res) {
  res.json({ room: await rooms.joinRoom(req.user, req.params.id, req) });
}

export async function leave(req, res) {
  await rooms.leaveRoom(req.user._id, req.params.id, req);
  res.status(204).end();
}
