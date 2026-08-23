import mongoose from "mongoose";

const watchPartySchema = mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  hostId: { type: String, required: true },
  videoId: { type: String, required: true },
  participants: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["active", "ended"], default: "active" },
});

export default mongoose.model("WatchParty", watchPartySchema);
