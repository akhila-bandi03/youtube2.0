import express from "express";
import WatchParty from "../Modals/WatchParty.js";
import crypto from "crypto";

const router = express.Router();

router.post("/create", async (req, res) => {
  const { videoId, hostId } = req.body;
  try {
    const roomId = crypto.randomBytes(4).toString("hex");
    const newParty = new WatchParty({
      roomId,
      hostId,
      videoId,
      participants: [hostId],
    });
    await newParty.save();
    res.status(200).json({ success: true, roomId });
  } catch (error) {
    res.status(500).json({ error: "Failed to create watch party" });
  }
});

router.get("/join/:id", async (req, res) => {
  try {
    const party = await WatchParty.findOne({ roomId: req.params.id, status: "active" });
    if (!party) {
      return res.status(404).json({ error: "Watch party not found or ended" });
    }
    res.status(200).json({ success: true, party });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
