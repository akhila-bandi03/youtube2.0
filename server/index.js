import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import userroutes from "./routes/auth.js";
import videoroutes from "./routes/video.js";
import likeroutes from "./routes/like.js";
import watchlaterroutes from "./routes/watchlater.js";
import historyrroutes from "./routes/history.js";
import commentroutes from "./routes/comment.js";
import apiroutes from "./routes/api.js";
import watchpartyroutes from "./routes/watchparty.js";

const app = express();
const httpServer = createServer(app);


export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  }
});

import path from "path";

const allowedOrigins = [
  "http://localhost:3000",
  "https://youtube2-0-one.vercel.app",
  // Add more Vercel preview URLs if needed
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-requested-with", "bypass-tunnel-reminder", "x-user-id"],
}));

// Explicit OPTIONS preflight handler — needed for localtunnel + CORS
app.options(/.*/, cors());


app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use("/uploads", express.static(path.join("uploads")));
app.get("/", (req, res) => {
  res.send("You tube backend is working");
});
app.use(bodyParser.json());
app.use("/user", userroutes);
app.use("/video", videoroutes);
app.use("/like", likeroutes);
app.use("/watch", watchlaterroutes);
app.use("/history", historyrroutes);
app.use("/comment", commentroutes);
app.use("/api", apiroutes);
app.use("/watchparty", watchpartyroutes);

// Socket.IO Logic
io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  socket.on("join-room", (roomId, userId, userName) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId, userName);
    console.log(`User ${userName} (${userId}) joined room ${roomId}`);

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
      console.log(`User ${userName} (${userId}) left room ${roomId}`);
    });
  });

  socket.on("chat-message", (roomId, message) => {
    socket.to(roomId).emit("chat-message", message);
  });

  // Video Sync
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
});

const PORT = process.env.PORT || 5000;

// Vercel sets VERCEL=1, so we only listen manually when running locally
if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
  });
}

import CommentModel from "./Modals/comment.js";
import VideoModel from "./Modals/video.js";

const DBURL = process.env.DB_URL || "mongodb://127.0.0.1:27017/youtube";
mongoose
  .connect(DBURL)
  .then(async () => {
    console.log("Mongodb connected");
    try {
      // 1. Seed Videos if empty
      let videoCount = await VideoModel.countDocuments();
      let seededVideoId = null;

      if (videoCount === 0) {
        console.log("Seeding mock videos for testing...");
        const seededVideos = await VideoModel.insertMany([
          {
            videotitle: "Introducing QuantumDB: The Distributed Database of the Future",
            filename: "quantumdb_launch.mp4",
            filetype: "video/mp4",
            filepath: "uploads/quantumdb_launch.mp4",
            filesize: "5242880", // 5MB
            videochanel: "EchoSphere Tech",
            Like: 124,
            views: 1205,
            uploader: "EchoSphere Team"
          },
          {
            videotitle: "React 19 & Next.js 15: Essential Tutorial Guide",
            filename: "nextjs_tutorial.mp4",
            filetype: "video/mp4",
            filepath: "uploads/nextjs_tutorial.mp4",
            filesize: "10485760", // 10MB
            videochanel: "WebDev Mastery",
            Like: 256,
            views: 4520,
            uploader: "DevTeacher",
            isPremium: true
          }
        ]);
        console.log("Mock videos successfully seeded.");
        seededVideoId = seededVideos[0]._id;
      } else {
        const existingVideos = await VideoModel.find({});
        seededVideoId = existingVideos[0]._id;
        if (existingVideos.length > 1) {
          existingVideos[1].isPremium = true;
          await existingVideos[1].save();
        }
      }

      // 2. Seed Comments if empty
      const commentCount = await CommentModel.countDocuments();
      if (commentCount === 0 && seededVideoId) {
        console.log("Seeding comments linked to seeded videos...");
        const dummyUserId = new mongoose.Types.ObjectId();
        
        await CommentModel.insertMany([
          {
            userId: dummyUserId,
            videoid: seededVideoId,
            username: "JeanDeveloper",
            comment: "Ce projet a l'air fantastique! J'ai hâte de l'essayer.",
            language: "fr",
            likes: 12,
            dislikes: 1,
            moderationStatus: "approved",
            reportReason: null,
            location: "Western Europe Region"
          },
          {
            userId: dummyUserId,
            videoid: seededVideoId,
            username: "TechPioneer",
            comment: "This is an incredible database design! Love the Rust implementation.",
            language: "en",
            likes: 24,
            dislikes: 0,
            moderationStatus: "approved",
            reportReason: null,
            location: "North America Region"
          },
          {
            userId: dummyUserId,
            videoid: seededVideoId,
            username: "RaviTeja",
            comment: "ఈ ప్రాజెక్ట్ చాలా అద్భుతంగా ఉంది! రస్ట్ వాడటం బాగుంది.",
            language: "te",
            likes: 8,
            dislikes: 0,
            moderationStatus: "approved",
            reportReason: null,
            location: "South Asia Region"
          },
          {
            userId: dummyUserId,
            videoid: seededVideoId,
            username: "SpamBot",
            comment: "Get rich quick! Click here for free money: http://scam.com",
            language: "en",
            likes: 0,
            dislikes: 18,
            reports: 1,
            moderationStatus: "flagged",
            reportReason: "Spam or promotion",
            location: null
          }
        ]);
        console.log("Comments successfully seeded.");
      }
    } catch (err) {
      console.error("Failed to seed initial database items:", err);
    }
  })
  .catch((error) => {
    console.log(error);
  });

// Export the Express API for Vercel Serverless Functions
export default app;
