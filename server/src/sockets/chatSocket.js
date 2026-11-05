import mongoose from 'mongoose';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { COOKIE_NAME } from '../utils/token.js';

const userRoom = id => `user:${id}`;

function getCookie(cookieHeader, name) {
  const cookies = {};

  for (const part of (cookieHeader || '').split(';')) {
    const index = part.indexOf('=');

    if (index === -1) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  return cookies[name];
}

export function registerChatSocket(io) {
  const onlineUsers = new Map();

  io.use(async (socket, next) => {
    try {
      const token = getCookie(
        socket.handshake.headers.cookie,
        COOKIE_NAME
      );

      const user = await authenticateToken(token);

      socket.user = user;
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', socket => {
    const userId = socket.user._id.toString();

    socket.join(userRoom(userId));
    socket.join('global');

    onlineUsers.set(
      userId,
      (onlineUsers.get(userId) || 0) + 1
    );

    io.to('global').emit('presence:update', {
      userId,
      online: true,
    });

    socket.on('chat:send', async (payload, callback) => {
      try {
        const type = payload?.type;
        const text = String(payload?.text || '').trim();

        if (!['private', 'global'].includes(type)) {
          throw new Error('Invalid chat type');
        }

        if (!text || text.length > 2000) {
          throw new Error('Message must contain 1–2000 characters');
        }

        let recipient = null;

        if (type === 'private') {
          const recipientId = payload?.recipientId;

          if (
            !mongoose.isValidObjectId(recipientId) ||
            recipientId === userId
          ) {
            throw new Error('Invalid recipient');
          }

          recipient = await User.findById(recipientId);

          if (!recipient) {
            throw new Error('Recipient not found');
          }
        }

        const message = await Message.create({
          type,
          sender: socket.user._id,
          recipient: recipient?._id || null,
          text,
        });

        const saved = await Message.findById(message._id)
          .populate('sender', 'username displayName avatarColor')
          .lean();

        if (type === 'global') {
          io.to('global').emit('chat:message', saved);
        } else {
          io.to(userRoom(userId)).emit('chat:message', saved);

          io.to(userRoom(recipient._id.toString()))
            .emit('chat:message', saved);
        }

        if (callback) {
          callback({ success: true, message: saved });
        }
      } catch (error) {
        if (callback) {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    });

    socket.on('chat:typing', payload => {
      if (payload?.type === 'global') {
        socket.to('global').emit('chat:typing', {
          userId,
          username: socket.user.displayName,
          type: 'global',
        });

        return;
      }

      if (mongoose.isValidObjectId(payload?.recipientId)) {
        io.to(userRoom(payload.recipientId)).emit(
          'chat:typing',
          {
            userId,
            username: socket.user.displayName,
            type: 'private',
          }
        );
      }
    });

    socket.on('chat:stop-typing', payload => {
      if (payload?.type === 'global') {
        socket.to('global').emit('chat:stop-typing', {
          userId,
          type: 'global',
        });

        return;
      }

      if (mongoose.isValidObjectId(payload?.recipientId)) {
        io.to(userRoom(payload.recipientId)).emit(
          'chat:stop-typing',
          {
            userId,
            type: 'private',
          }
        );
      }
    });

    socket.on('chat:read', async payload => {
      try {
        if (!mongoose.isValidObjectId(payload?.senderId)) return;

        const result = await Message.updateMany(
          {
            type: 'private',
            sender: payload.senderId,
            recipient: socket.user._id,
            readAt: null,
          },
          { $set: { readAt: new Date() } }
        );

        io.to(userRoom(payload.senderId)).emit(
          'chat:read-receipt',
          {
            readerId: userId,
            count: result.modifiedCount,
          }
        );
      } catch (error) {
        socket.emit('chat:error', {
          message: 'Unable to update read receipts',
        });
      }
    });

    socket.on('disconnect', () => {
      const count = (onlineUsers.get(userId) || 1) - 1;

      if (count <= 0) {
        onlineUsers.delete(userId);

        io.to('global').emit('presence:update', {
          userId,
          online: false,
        });
      } else {
        onlineUsers.set(userId, count);
      }
    });
  });
}