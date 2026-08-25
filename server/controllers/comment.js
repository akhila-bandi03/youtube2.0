import comment from "../Modals/comment.js";
import mongoose from "mongoose";

// ─────────────────────────────────────────────
// Moderation Configuration
// ─────────────────────────────────────────────
const BANNED_WORDS = [
  'badword', 'idiot', 'moron', 'jerk', 'abuse', 'spam', 'scam',
  'fudge', 'bastard', 'offensive', 'abusive', 'stupid', 'dumb',
  'hate', 'kill', 'shut up'
];

const SPAM_PHRASES = [
  'buy now', 'free money', 'click here', 'make money fast',
  'crypto riches', 'get rich quick', 'earn from home', 'limited offer'
];

/**
 * Validates comment text for:
 * 1. Abusive / offensive words
 * 2. Spam phrases
 * 3. External links (phishing/spam prevention)
 * 4. Repeated special characters like !!!!, ####, @@@@
 */
function validateCommentText(text) {
  const textLower = text.toLowerCase();

  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(textLower)) {
      return { valid: false, error: `Inappropriate language detected. The word "${word}" is not allowed in our community.` };
    }
  }

  for (const phrase of SPAM_PHRASES) {
    if (textLower.includes(phrase)) {
      return { valid: false, error: "Spam-like content detected. Promotional phrases are not permitted." };
    }
  }

  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  if (urlPattern.test(text)) {
    return { valid: false, error: "External links are not allowed in comments to keep our community safe." };
  }

  const repeatedSpecial = /([!@#$%^&*()\-_=+{}[\]|\\:;"'<>,.?/~`])\1{3,}/g;
  if (repeatedSpecial.test(text)) {
    return { valid: false, error: "Comment contains excessive repeated special characters. Please write a meaningful message." };
  }

  return { valid: true };
}

// POST /comment — legacy route (frontend now uses /api/comments)
export const postcomment = async (req, res) => {
  const { userid, videoid, commentbody, usercommented, lang, location } = req.body;

  if (!commentbody || !userid || !videoid) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const validation = validateCommentText(commentbody);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Duplicate spam prevention — same user, same text within 1 minute
  const oneMinAgo = new Date(Date.now() - 60000);
  const duplicate = await comment.findOne({
    userId: userid,
    comment: commentbody,
    createdAt: { $gte: oneMinAgo }
  });
  if (duplicate) {
    return res.status(400).json({ error: "Duplicate comment detected. Please wait before re-posting." });
  }

  const newComment = new comment({
    userId: userid,
    videoid,
    comment: commentbody,
    username: usercommented || "Anonymous",
    language: lang || "en",
    location: location || null,
    moderationStatus: "approved"
  });

  try {
    const saved = await newComment.save();
    return res.status(200).json(saved);
  } catch (error) {
    console.error("postcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// GET /comment/:videoid
export const getallcomment = async (req, res) => {
  const { videoid } = req.params;
  try {
    const commentvideo = await comment.find({ videoid }).sort({ createdAt: -1 });
    return res.status(200).json(commentvideo);
  } catch (error) {
    console.error("getallcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// DELETE /comment/:id
export const deletecomment = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    await comment.findByIdAndDelete(_id);
    return res.status(200).json({ comment: true });
  } catch (error) {
    console.error("deletecomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// PUT /comment/:id
export const editcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { commentbody } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }

  if (commentbody) {
    const validation = validateCommentText(commentbody);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
  }

  try {
    const updatecomment = await comment.findByIdAndUpdate(
      _id,
      { $set: { comment: commentbody } },
      { new: true }
    );
    res.status(200).json(updatecomment);
  } catch (error) {
    console.error("editcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// PUT /comment/:id/like
export const likecomment = async (req, res) => {
  const { id: _id } = req.params;
  const { isAdd, removeOpposite } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    const targetComment = await comment.findById(_id);
    if (!targetComment) return res.status(404).send("comment not found");

    targetComment.likes += isAdd ? 1 : -1;
    if (removeOpposite) {
      targetComment.dislikes = Math.max(0, targetComment.dislikes - 1);
    }
    targetComment.likes = Math.max(0, targetComment.likes);

    const saved = await targetComment.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error("likecomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// PUT /comment/:id/dislike — NEVER auto-deletes (per requirements)
export const dislikecomment = async (req, res) => {
  const { id: _id } = req.params;
  const { isAdd, removeOpposite } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    const targetComment = await comment.findById(_id);
    if (!targetComment) return res.status(404).send("comment not found");

    targetComment.dislikes += isAdd ? 1 : -1;
    if (removeOpposite) {
      targetComment.likes = Math.max(0, targetComment.likes - 1);
    }
    // High dislike count does NOT trigger auto-deletion; only admin review can remove
    targetComment.dislikes = Math.max(0, targetComment.dislikes);

    const saved = await targetComment.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error("dislikecomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// POST /comment/:id/report — flags for admin review, never auto-deletes
export const reportcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { reason, userId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    const targetComment = await comment.findById(_id);
    if (!targetComment) return res.status(404).send("comment not found");

    // Server-side duplicate report check
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const userObjId = new mongoose.Types.ObjectId(userId);
      const alreadyReported = targetComment.reportedBy.some(uid => uid.equals(userObjId));
      if (alreadyReported) {
        return res.status(400).json({ error: "You have already reported this comment." });
      }
      targetComment.reportedBy.push(userObjId);
    }

    targetComment.reports += 1;
    targetComment.reportReason = reason || "Community guidelines violation";
    // Use moderationStatus to flag for admin review — NEVER auto-delete
    targetComment.moderationStatus = "flagged";

    const saved = await targetComment.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error("reportcomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// GET /comment/flagged — admin: get all flagged comments
export const getflaggedcomments = async (req, res) => {
  try {
    // Query moderationStatus field (matches Mongoose model — not legacy 'reported' boolean)
    const flagged = await comment.find({ moderationStatus: "flagged" }).sort({ reports: -1 });
    res.status(200).json(flagged);
  } catch (error) {
    console.error("getflaggedcomments error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// PUT /comment/:id/approve — admin: clear flag and restore comment
export const approvecomment = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    const targetComment = await comment.findById(_id);
    if (!targetComment) return res.status(404).send("comment not found");

    targetComment.moderationStatus = "approved";
    targetComment.reportReason = null;
    targetComment.reports = 0;
    targetComment.reportedBy = [];

    const saved = await targetComment.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error("approvecomment error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
