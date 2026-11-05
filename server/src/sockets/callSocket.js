import { randomUUID } from "node:crypto";

const calls = new Map();
const userSockets = new Map();
const activeCalls = new Map();

const RING_TIMEOUT = 30_000;

function addSocket(userId, socketId) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }

  userSockets.get(userId).add(socketId);
}

function removeSocket(userId, socketId) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;

  sockets.delete(socketId);

  if (sockets.size === 0) {
    userSockets.delete(userId);
  }
}

function emitToUser(io, userId, event, data) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;

  for (const socketId of sockets) {
    io.to(socketId).emit(event, data);
  }
}

function clearTimer(call) {
  if (call.timer) {
    clearTimeout(call.timer);
    call.timer = null;
  }
}

function deleteCall(call) {
  clearTimer(call);

  calls.delete(call.callId);
  activeCalls.delete(call.callerId);
  activeCalls.delete(call.calleeId);
}

export function registerCallSocket(io) {
  io.on("connection", (socket) => {
    const userId = String(socket.data.user._id);

    addSocket(userId, socket.id);

    socket.on("call:invite", ({ targetUserId, mode } = {}) => {
      const targetId = String(targetUserId || "");

      if (
        !targetId ||
        targetId === userId ||
        !["voice", "video"].includes(mode)
      ) {
        return;
      }

      if (activeCalls.has(userId)) {
        socket.emit("call:rejected", {
          reason: "You are already in another call.",
        });
        return;
      }

      if (activeCalls.has(targetId)) {
        socket.emit("call:rejected", {
          reason: "Employee is busy.",
        });
        return;
      }

      const targetSockets = userSockets.get(targetId);

      if (!targetSockets || targetSockets.size === 0) {
        socket.emit("call:rejected", {
          reason: "Employee is offline.",
        });
        return;
      }

      const callId = randomUUID();

      const call = {
        callId,
        callerId: userId,
        calleeId: targetId,
        callerSocketId: socket.id,
        calleeSocketId: null,
        mode,
        accepted: false,
        timer: null,
      };

      calls.set(callId, call);

      activeCalls.set(userId, callId);
      activeCalls.set(targetId, callId);

      socket.emit("call:outgoing", { callId });

      emitToUser(io, targetId, "call:incoming", {
        callId,
        mode,
        caller: {
          id: userId,
          username: socket.data.user.username,
          displayName: socket.data.user.displayName,
        },
      });

      call.timer = setTimeout(() => {
        const currentCall = calls.get(callId);

        if (!currentCall || currentCall.accepted) return;

        emitToUser(io, currentCall.callerId, "call:timeout", {
          callId,
          message: "No answer. Call timed out.",
        });

        emitToUser(io, currentCall.calleeId, "call:missed", {
          callId,
          message: "Missed call.",
        });

        deleteCall(currentCall);
      }, RING_TIMEOUT);
    });

    socket.on("call:accept", ({ callId } = {}) => {
      const call = calls.get(callId);

      if (
        !call ||
        call.calleeId !== userId ||
        call.accepted
      ) {
        return;
      }

      clearTimer(call);

      call.accepted = true;
      call.calleeSocketId = socket.id;

      io.to(call.callerSocketId).emit("call:accepted", {
        callId,
        mode: call.mode,
      });

      socket.emit("call:joined", { callId });
    });

    socket.on("call:reject", ({ callId } = {}) => {
      const call = calls.get(callId);

      if (!call || call.calleeId !== userId) return;

      io.to(call.callerSocketId).emit("call:rejected", {
        callId,
        reason: "Call rejected.",
      });

      deleteCall(call);
    });

    socket.on("call:offer", ({ callId, offer } = {}) => {
      const call = calls.get(callId);

      if (
        !call ||
        !call.accepted ||
        call.callerSocketId !== socket.id ||
        !offer
      ) {
        return;
      }

      io.to(call.calleeSocketId).emit("call:offer", {
        callId,
        offer,
      });
    });

    socket.on("call:answer", ({ callId, answer } = {}) => {
      const call = calls.get(callId);

      if (
        !call ||
        !call.accepted ||
        call.calleeSocketId !== socket.id ||
        !answer
      ) {
        return;
      }

      io.to(call.callerSocketId).emit("call:answer", {
        callId,
        answer,
      });
    });

    socket.on("call:ice", ({ callId, candidate } = {}) => {
      const call = calls.get(callId);

      if (!call || !call.accepted || !candidate) return;

      let targetSocketId;

      if (socket.id === call.callerSocketId) {
        targetSocketId = call.calleeSocketId;
      } else if (socket.id === call.calleeSocketId) {
        targetSocketId = call.callerSocketId;
      } else {
        return;
      }

      if (targetSocketId) {
        io.to(targetSocketId).emit("call:ice", {
          callId,
          candidate,
        });
      }
    });

    socket.on("call:leave", ({ callId } = {}) => {
      const call = calls.get(callId);

      if (!call) return;

      if (
        socket.id !== call.callerSocketId &&
        socket.id !== call.calleeSocketId
      ) {
        return;
      }

      emitToUser(io, call.callerId, "call:ended", { callId });
      emitToUser(io, call.calleeId, "call:ended", { callId });

      deleteCall(call);
    });

    socket.on("disconnect", () => {
      removeSocket(userId, socket.id);

      for (const call of calls.values()) {
        if (
          call.callerSocketId === socket.id ||
          call.calleeSocketId === socket.id
        ) {
          emitToUser(io, call.callerId, "call:ended", {
            callId: call.callId,
          });

          emitToUser(io, call.calleeId, "call:ended", {
            callId: call.callId,
          });

          deleteCall(call);
          break;
        }
      }
    });
  });
}