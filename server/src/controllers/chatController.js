import mongoose from 'mongoose';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSelf() });
});

export const searchUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();

  const filter = {
    _id: { $ne: req.user._id },
    isDiscoverable: true,
  };

  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    filter.$or = [
      { username: { $regex: escaped, $options: 'i' } },
      { displayName: { $regex: escaped, $options: 'i' } },
    ];
  }

  const users = await User.find(filter)
    .select('username displayName avatarColor')
    .limit(30)
    .lean();

  res.json({
    users: users.map(user => ({
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
    })),
  });
});

export const getGlobalMessages = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const messages = await Message.find({ type: 'global' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username displayName avatarColor')
    .lean();

  res.json({
    messages: messages.reverse(),
  });
});

export const getPrivateMessages = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError(400, 'Invalid user ID', 'BAD_ID');
  }

  const otherUser = await User.findById(userId);

  if (!otherUser) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const messages = await Message.find({
    type: 'private',
    $or: [
      { sender: req.user._id, recipient: userId },
      { sender: userId, recipient: req.user._id },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('sender', 'username displayName avatarColor')
    .lean();

  res.json({
    messages: messages.reverse(),
  });
});

export const getConversations = asyncHandler(async (req, res) => {
  const messages = await Message.find({
    type: 'private',
    $or: [
      { sender: req.user._id },
      { recipient: req.user._id },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(500)
    .populate('sender', 'username displayName avatarColor')
    .populate('recipient', 'username displayName avatarColor')
    .lean();

  const conversations = new Map();

  for (const message of messages) {
    const senderId = message.sender?._id?.toString();
    const recipientId = message.recipient?._id?.toString();

    const other =
      senderId === req.user._id.toString()
        ? message.recipient
        : message.sender;

    if (!other) continue;

    const id = other._id.toString();

    if (!conversations.has(id)) {
      conversations.set(id, {
        user: {
          id,
          username: other.username,
          displayName: other.displayName,
          avatarColor: other.avatarColor,
        },
        lastMessage: message,
        unread: 0,
      });
    }

    if (
      recipientId === req.user._id.toString() &&
      !message.readAt
    ) {
      conversations.get(id).unread++;
    }
  }

  res.json({
    conversations: [...conversations.values()],
  });
});