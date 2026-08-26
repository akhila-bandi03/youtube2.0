import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end("YourTube Socket Server is running!");
});

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://youtube2-0-one.vercel.app",
      /\.vercel\.app$/
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  socket.on("join-room", (roomId, userId, userName) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId, userName);
    console.log(`${userName} joined room ${roomId}`);

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
      console.log(`${userName} left room ${roomId}`);
    });
  });

  socket.on("chat-message", (roomId, message) => {
    socket.to(roomId).emit("chat-message", message);
  });

  socket.on("video-play",  (roomId, time) => socket.to(roomId).emit("video-play",  time));
  socket.on("video-pause", (roomId, time) => socket.to(roomId).emit("video-pause", time));
  socket.on("video-seek",  (roomId, time) => socket.to(roomId).emit("video-seek",  time));

  // WebRTC Signaling
  socket.on("offer",         (roomId, callerId, offer)     => socket.to(roomId).emit("offer",         callerId, offer));
  socket.on("answer",        (roomId, callerId, answer)    => socket.to(roomId).emit("answer",        callerId, answer));
  socket.on("ice-candidate", (roomId, callerId, candidate) => socket.to(roomId).emit("ice-candidate", callerId, candidate));
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
