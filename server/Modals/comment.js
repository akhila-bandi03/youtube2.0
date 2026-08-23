import mongoose from "mongoose";

const commentschema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    videoid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },
    username: { 
      type: String, 
      required: true 
    },
    avatar: { 
      type: String, 
      default: null 
    },
    comment: { 
      type: String, 
      required: true 
    },
    language: { 
      type: String, 
      default: "en" 
    },
    translatedComments: {
      type: Map,
      of: String,
      default: {}
    },
    location: { 
      type: String, 
      default: null 
    },
    // Aggregate counts (kept for display performance)
    likes: { 
      type: Number, 
      default: 0 
    },
    dislikes: { 
      type: Number, 
      default: 0 
    },
    reports: { 
      type: Number, 
      default: 0 
    },
    // Per-user tracking arrays (for server-side deduplication — persists across sessions)
    likedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
    },
    dislikedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
    },
    reportedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
    },
    reportReason: { 
      type: String, 
      default: null 
    },
    moderationStatus: { 
      type: String, 
      enum: ["approved", "flagged", "pending"],
      default: "approved" 
    }
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("comment", commentschema);
