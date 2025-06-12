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

  // เก็บ user id ที่ออนไลน์
  const onlineUsers = new Set();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("user-online", (userId) => {
      socket.userId = userId;
      onlineUsers.add(userId);
      io.emit("user-online", Array.from(onlineUsers));
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit("user-online", Array.from(onlineUsers));
      }
    });

    socket.on("set-user-id", (userId) => {
      socket.userId = userId;
    });
  });
};

module.exports = { startSocketServer };
