import Download from "../Modals/download.js";
import User from "../Modals/Auth.js";
import Video from "../Modals/video.js";
import mongoose from "mongoose";

// Plan limits — defined once, used server-side only
const PLAN_LIMITS = {
  free:    1,
  bronze:  3,
  silver:  5,
  gold:    50,
  premium: 10   // generic "premium" fallback
};

// POST /api/downloads
// Security: userId is taken from req.body but the plan is always looked up
// from the DB — the client cannot forge a higher plan.
export const createDownload = async (req, res) => {
  const { userId, videoId } = req.body;

  if (!userId || !videoId) {
    return res.status(400).json({ error: "userId and videoId are required" });
  }

  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ error: "Invalid userId or videoId" });
  }

  try {
    // ─── 1. Look up user in DB — plan comes from HERE, NOT from req.body (Req #15) ───
    const userRecord = await User.findById(userId);
    if (!userRecord) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }
    const userPlan = userRecord.plan || "free";   // server-sourced plan

    // ─── 2. Look up video in DB — validate it exists ───
    const videoRecord = await Video.findById(videoId);
    if (!videoRecord) {
      return res.status(404).json({ error: "Video not found" });
    }

    // ─── 3. Calculate today's download count (Req #9, #12) ───
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const downloadCount = await Download.countDocuments({
      userId,
      downloadedAt: { $gte: startOfToday, $lte: endOfToday }
    });

    // ─── 4. Enforce plan limits on backend (Req #1, #2, #3, #10, #11, #13) ───
    const limit = PLAN_LIMITS[userPlan] ?? 1;   // Default to 1 for unknown plans

    if (downloadCount >= limit) {
      return res.status(403).json({
        error: `Daily download limit reached. Your ${userPlan.toUpperCase()} plan allows ${limit} download${limit === 1 ? "" : "s"} per day. ${userPlan === "free" ? "Upgrade to a premium plan for more downloads!" : userPlan === "gold" ? "" : "Upgrade for more!"}`
      });
    }

    // ─── 5. Save download record with server-sourced data (Req #5, #6) ───
    const newDownload = new Download({
      userId,
      videoId,
      videoTitle: videoRecord.videotitle,   // stored directly — persists if video deleted
      userPlan                               // server-sourced plan, not client's
    });

    const saved = await newDownload.save();

    // ─── 6. Return download info + remaining quota ───
    res.status(201).json({
      ...saved.toObject(),
      remainingToday: limit - downloadCount - 1,
      limit,
      userPlan
    });
  } catch (error) {
    console.error("createDownload error:", error);
    res.status(500).json({ error: "Failed to process download" });
  }
};

// GET /api/downloads/:userId
export const getDownloadsByUserId = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid User ID" });
  }

  try {
    const downloads = await Download.find({ userId })
      .populate("videoId")          // Populate full video details
      .sort({ downloadedAt: -1 });  // Newest first

    // Calculate today's count for quota display
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayCount = downloads.filter(
      (d) => new Date(d.downloadedAt) >= startOfToday
    ).length;

    res.status(200).json({ downloads, todayCount });
  } catch (error) {
    console.error("getDownloadsByUserId error:", error);
    res.status(500).json({ error: "Failed to retrieve download history" });
  }
};
