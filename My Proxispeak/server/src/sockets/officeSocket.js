const positions = new Map();
const userSockets = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getUserPosition(user) {
  const id = String(user._id);

  if (!positions.has(id)) {
    // Initial position for a newly joined employee.
    const hash = [...id].reduce(
      (total, char) => total + char.charCodeAt(0),
      0
    );

    positions.set(id, {
      userId: id,
      username: user.username || "Employee",
      displayName: user.displayName || user.username || "Employee",
      avatarColor: user.avatarColor || "#5265d8",
      x: 35 + (hash % 30),
      y: 55 + (hash % 20),
      room: "Main Office",
      online: true,
    });
  }

  return positions.get(id);
}

function emitSnapshot(socket, currentUserId) {
  socket.emit("office:snapshot", {
    currentUserId,
    users: Array.from(positions.values()),
  });
}

export function registerOfficeSocket(io) {
  io.on("connection", (socket) => {
    const user = socket.data.user;
    const userId = String(user._id);

    socket.on("office:join", () => {
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }

      userSockets.get(userId).add(socket.id);

      const currentUser = getUserPosition(user);

      emitSnapshot(socket, userId);

      socket.broadcast.emit("office:user-joined", currentUser);
    });

    socket.on("office:move", (data = {}) => {
      const currentUser = positions.get(userId);

      if (!currentUser) return;

      const x = Number(data.x);
      const y = Number(data.y);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }

      currentUser.x = clamp(x, 2, 98);
      currentUser.y = clamp(y, 2, 98);

      if (typeof data.room === "string") {
        currentUser.room = data.room.slice(0, 40);
      }

      io.emit("office:user-moved", currentUser);
    });

    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);

      if (!sockets) return;

      sockets.delete(socket.id);

      if (sockets.size === 0) {
        userSockets.delete(userId);

        const userPosition = positions.get(userId);

        if (userPosition) {
          userPosition.online = false;

          io.emit("office:user-left", {
            userId,
          });

          positions.delete(userId);
        }
      }
    });
  });
}