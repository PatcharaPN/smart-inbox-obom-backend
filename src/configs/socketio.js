const { Server } = require("socket.io");

const startSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        "http://database.obomgauge.com",
        "http://localhost:5173",
        "http://100.127.64.22",
      ],
      methods: ["GET", "DELETE", "POST", "PUT"],
      credentials: true,
    },
  });

  const userStatus = new Map();

  io.on("connection", (socket) => {
    socket.on("user-online", (userId) => {
      userStatus.set(userId, "online");
      io.emit("user-status-update", Object.fromEntries(userStatus));
    });

    socket.on("user-active", (userId) => {
      userStatus.set(userId, "active");
      io.emit("user-status-update", Object.fromEntries(userStatus));
    });

    socket.on("user-away", (userId) => {
      userStatus.set(userId, "away");
      io.emit("user-status-update", Object.fromEntries(userStatus));
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        userStatus.delete(socket.userId);
        io.emit("user-status-update", Object.fromEntries(userStatus));
      }
    });
  });
};

module.exports = { startSocketServer };
