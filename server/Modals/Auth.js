import mongoose from "mongoose";
const userschema = mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  channelname: { type: String },
  description: { type: String },
  image: { type: String },
  plan: { type: String, enum: ["free", "bronze", "silver", "gold", "premium"], default: "free" },
  theme: { type: String, enum: ["light", "dark", "auto"], default: "auto" },
  lastLocation: { type: String, default: null },
  lastDevice: { type: String, default: null },
  otpCode: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },
  joinedon: { type: Date, default: Date.now },
});

export default mongoose.model("user", userschema);
