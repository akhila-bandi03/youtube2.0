import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get("/", (req, res) => res.send("Watch Party Socket Server Running ✅"));

// ── Watch Party Signaling ──
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId, userId, userName) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId, userName);
    console.log(`${userName} joined room ${roomId}`);
  });

  socket.on("chat-message", (roomId, msg) => {
    socket.to(roomId).emit("chat-message", msg);
  });

  socket.on("video-play", (roomId, time) => {
    socket.to(roomId).emit("video-play", time);
  });

  socket.on("video-pause", (roomId, time) => {
    socket.to(roomId).emit("video-pause", time);
  });

  socket.on("video-seek", (roomId, time) => {
    socket.to(roomId).emit("video-seek", time);
  });

  // WebRTC Signaling
  socket.on("offer", (roomId, callerId, offer) => {
    socket.to(roomId).emit("offer", callerId, offer);
  });

  socket.on("answer", (roomId, callerId, answer) => {
    socket.to(roomId).emit("answer", callerId, answer);
  });

  socket.on("ice-candidate", (roomId, callerId, candidate) => {
    socket.to(roomId).emit("ice-candidate", callerId, candidate);
  });

  socket.on("disconnect", () => {
    io.emit("user-disconnected", socket.id);
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
