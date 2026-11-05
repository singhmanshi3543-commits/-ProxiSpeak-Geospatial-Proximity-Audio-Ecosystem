import { Connection, makePairKey } from '../models/Connection.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from '../services/audit.js';
import { isWithinProximity } from '../services/proximity.js';

const USER_FIELDS = 'username displayName avatarColor';

function toDto(conn, meId) {
  const outgoing = conn.requester._id.equals(meId);
  const other = outgoing ? conn.recipient : conn.requester;
  return {
    id: conn._id.toString(),
    status: conn.status,
    direction: outgoing ? 'outgoing' : 'incoming',
    user: { id: other._id.toString(), username: other.username, displayName: other.displayName, avatarColor: other.avatarColor },
    updatedAt: conn.updatedAt,
  };
}

export async function request(req, res) {
  const targetId = req.body.userId;
  if (targetId === req.user._id.toString()) throw new AppError(400, 'You cannot connect with yourself', 'SELF_CONNECT');
  if (!(await User.exists({ _id: targetId }))) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');

  if (!(await isWithinProximity(req.user, targetId, { requireDiscoverable: true }))) {
    await recordAudit({ action: 'connection.denied', userId: req.user._id, req, meta: { targetId, reason: 'out_of_range' } });
    throw new AppError(403, 'That user is not within range', 'NOT_NEARBY');
  }

  const pairKey = makePairKey(req.user._id, targetId);
  let conn = await Connection.findOne({ pairKey });
  if (conn) {
    if (conn.status !== 'declined') throw new AppError(409, 'A connection already exists or is pending', 'CONFLICT');
    conn.set({ requester: req.user._id, recipient: targetId, status: 'pending' });
    await conn.save();
  } else {
    try {
      conn = await Connection.create({ requester: req.user._id, recipient: targetId, pairKey });
    } catch (err) {
      if (err?.code === 11000) throw new AppError(409, 'A connection already exists or is pending', 'CONFLICT');
      throw err;
    }
  }
  await recordAudit({ action: 'connection.request', userId: req.user._id, req, meta: { connectionId: conn._id.toString(), targetId } });
  res.status(201).json({ id: conn._id.toString(), status: conn.status });
}

export async function list(req, res) {
  const conns = await Connection.find({
    status: { $ne: 'declined' },
    $or: [{ requester: req.user._id }, { recipient: req.user._id }],
  })
    .sort({ updatedAt: -1 })
    .populate('requester recipient', USER_FIELDS);
  res.json({ connections: conns.map((c) => toDto(c, req.user._id)) });
}

async function respond(req, res, status, action) {
  const conn = await Connection.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id, status: 'pending' },
    { status },
    { new: true }
  );
  if (!conn) throw new AppError(404, 'No pending request found', 'NOT_FOUND');
  await recordAudit({ action, userId: req.user._id, req, meta: { connectionId: conn._id.toString() } });
  res.json({ id: conn._id.toString(), status: conn.status });
}

export const accept = (req, res) => respond(req, res, 'accepted', 'connection.accept');
export const decline = (req, res) => respond(req, res, 'declined', 'connection.decline');

export async function remove(req, res) {
  const conn = await Connection.findOneAndDelete({
    _id: req.params.id,
    $or: [{ requester: req.user._id }, { recipient: req.user._id }],
  });
  if (!conn) throw new AppError(404, 'Connection not found', 'NOT_FOUND');
  await recordAudit({ action: 'connection.remove', userId: req.user._id, req, meta: { connectionId: conn._id.toString() } });
  res.status(204).end();
}
