const { Server } = require("socket.io");

const startSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        "https:obomgauge.com",
        "http://db.obomgauge.com/",
        "http://database.obomgauge.com",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://100.127.64.22",
      ],
      methods: ["GET", "DELETE", "POST", "PUT"],
      credentials: true,
    },
  });

  const userStatus = new Map();
  const companyOnlineUsers = new Set();

  io.on("connection", (socket) => {
    console.log("Visitor Connected");

    socket.on("user-online", (userId) => {
      userStatus.set(userId, "online");
      io.emit("user-status-update", Object.fromEntries(userStatus));
    });

    socket.on("company-visitor", (visitorId) => {
      socket.visitorId = visitorId;
      companyOnlineUsers.add(visitorId);
      console.log(companyOnlineUsers.size);
      io.emit("company-online-count", companyOnlineUsers.size);
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

      if (socket.visitorId) {
        companyOnlineUsers.delete(socket.visitorId);
        io.emit("company-online-count", companyOnlineUsers.size);
      }
    });
  });
};

module.exports = { startSocketServer };
