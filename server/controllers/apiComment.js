import Comment from "../Modals/comment.js";
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
 * 1. Abusive / offensive words (backend-enforced)
 * 2. Spam phrases (backend-enforced)
 * 3. External links (backend-enforced)
 * 4. Repeated special characters like !!!!, ####, @@@@ (backend-enforced)
 */
function validateCommentContent(text) {
  const textLower = text.toLowerCase();

  // 1. Abusive / offensive words
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(textLower)) {
      return { valid: false, error: `Inappropriate language detected. The word "${word}" is not allowed in our community.` };
    }
  }

  // 2. Spam phrases
  for (const phrase of SPAM_PHRASES) {
    if (textLower.includes(phrase)) {
      return { valid: false, error: "Spam-like content detected. Promotional phrases are not permitted." };
    }
  }

  // 3. External links (phishing/spam prevention)
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  if (urlPattern.test(text)) {
    return { valid: false, error: "External links are not allowed in comments to keep our community safe." };
  }

  // 4. Repeated special characters — e.g. !!!!!, @@@@@, #####
  const repeatedSpecial = /([!@#$%^&*()\-_=+{}[\]|\\:;"'<>,.?/~`])\1{3,}/g;
  if (repeatedSpecial.test(text)) {
    return { valid: false, error: "Comment contains excessive repeated special characters. Please write a meaningful message." };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────
// 1. GET /api/comments?videoid=...
// ─────────────────────────────────────────────
export const getComments = async (req, res) => {
  const { videoid } = req.query;
  if (!videoid) return res.status(400).json({ error: "videoid query parameter is required" });

  try {
    // Fetch all comments (including flagged — do NOT auto-remove them per Req #12)
    // Sort newest first
    const comments = await Comment.find({ videoid }).sort({ createdAt: -1 });
    res.status(200).json(comments);
  } catch (error) {
    console.error("getComments error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

// ─────────────────────────────────────────────
// 2. POST /api/comments
// ─────────────────────────────────────────────
export const postComment = async (req, res) => {
  const { userId, videoid, username, avatar, comment, language, location } = req.body;

  if (!userId || !videoid || !username || !comment) {
    return res.status(400).json({ error: "Missing required fields: userId, videoid, username, comment" });
  }

  // A. Server-side content validation (Req #5, #6, #7, #14)
  const validation = validateCommentContent(comment);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    // B. Duplicate spam prevention — same user, same text within 1 minute
    const oneMinAgo = new Date(Date.now() - 60000);
    const duplicate = await Comment.findOne({
      userId,
      comment,
      createdAt: { $gte: oneMinAgo }
    });
    if (duplicate) {
      return res.status(400).json({ error: "Duplicate comment detected. Please wait 1 minute before posting the same message again." });
    }

    const newComment = new Comment({
      userId,
      videoid,
      username,
      avatar: avatar || null,
      comment,
      language: language || "en",
      location: location || null,   // Req #4: only saved when user opts in
      moderationStatus: "approved"
    });

    const saved = await newComment.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("postComment error:", error);
    res.status(500).json({ error: "Failed to save comment" });
  }
};

// ─────────────────────────────────────────────
// 3. PUT /api/comments/:id/like
// Server-side deduplication via likedBy[] array (Req #8, #13, #15)
// ─────────────────────────────────────────────
export const likeComment = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: "userId is required" });
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ error: "Invalid Comment ID" });

  try {
    const target = await Comment.findById(id);
    if (!target) return res.status(404).json({ error: "Comment not found" });

    const userObjId = new mongoose.Types.ObjectId(userId);
    const hasLiked    = target.likedBy.some(uid => uid.equals(userObjId));
    const hasDisliked = target.dislikedBy.some(uid => uid.equals(userObjId));

    if (hasLiked) {
      // Toggle off — remove like
      target.likedBy.pull(userObjId);
      target.likes = Math.max(0, target.likes - 1);
    } else {
      // Add like
      target.likedBy.push(userObjId);
      target.likes += 1;

      // If user had disliked this comment, remove that dislike
      if (hasDisliked) {
        target.dislikedBy.pull(userObjId);
        target.dislikes = Math.max(0, target.dislikes - 1);
      }
    }

    const saved = await target.save();
    res.status(200).json({
      _id: saved._id,
      likes: saved.likes,
      dislikes: saved.dislikes,
      userHasLiked: !hasLiked,
      userHasDisliked: false
    });
  } catch (error) {
    console.error("likeComment error:", error);
    res.status(500).json({ error: "Failed to update like" });
  }
};

// ─────────────────────────────────────────────
// 4. PUT /api/comments/:id/dislike
// Server-side deduplication via dislikedBy[] array (Req #9, #13, #15)
// ─────────────────────────────────────────────
export const dislikeComment = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: "userId is required" });
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ error: "Invalid Comment ID" });

  try {
    const target = await Comment.findById(id);
    if (!target) return res.status(404).json({ error: "Comment not found" });

    const userObjId   = new mongoose.Types.ObjectId(userId);
    const hasDisliked = target.dislikedBy.some(uid => uid.equals(userObjId));
    const hasLiked    = target.likedBy.some(uid => uid.equals(userObjId));

    if (hasDisliked) {
      // Toggle off — remove dislike
      target.dislikedBy.pull(userObjId);
      target.dislikes = Math.max(0, target.dislikes - 1);
    } else {
      // Add dislike — NOTE: high dislikes never auto-delete (Req #12)
      target.dislikedBy.push(userObjId);
      target.dislikes += 1;

      // If user had liked this comment, remove that like
      if (hasLiked) {
        target.likedBy.pull(userObjId);
        target.likes = Math.max(0, target.likes - 1);
      }
    }

    const saved = await target.save();
    res.status(200).json({
      _id: saved._id,
      likes: saved.likes,
      dislikes: saved.dislikes,
      userHasLiked: false,
      userHasDisliked: !hasDisliked
    });
  } catch (error) {
    console.error("dislikeComment error:", error);
    res.status(500).json({ error: "Failed to update dislike" });
  }
};

// ─────────────────────────────────────────────
// 5. POST /api/comments/:id/report
// Server-side dedup via reportedBy[] array (Req #10, #11, #12, #15)
// ─────────────────────────────────────────────
export const reportComment = async (req, res) => {
  const { id } = req.params;
  const { userId, reason } = req.body;

  if (!userId) return res.status(400).json({ error: "userId is required" });
  if (!reason)  return res.status(400).json({ error: "Report reason is required" });
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ error: "Invalid Comment ID" });

  try {
    const target = await Comment.findById(id);
    if (!target) return res.status(404).json({ error: "Comment not found" });

    const userObjId   = new mongoose.Types.ObjectId(userId);
    const alreadyReported = target.reportedBy.some(uid => uid.equals(userObjId));

    if (alreadyReported) {
      return res.status(400).json({ error: "You have already reported this comment." });
    }

    // Flag comment for admin/moderator review — do NOT delete (Req #11, #12)
    target.reportedBy.push(userObjId);
    target.reports   += 1;
    target.reportReason    = reason;
    target.moderationStatus = "flagged";

    const saved = await target.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error("reportComment error:", error);
    res.status(500).json({ error: "Failed to report comment" });
  }
};

// ─────────────────────────────────────────────
// 6. PUT /api/comments/:id  (Edit)
// Validates content on backend before saving (Req #14)
// ─────────────────────────────────────────────
export const editComment = async (req, res) => {
  const { id } = req.params;
  const { userId, comment } = req.body;

  if (!userId || !comment) return res.status(400).json({ error: "userId and comment are required" });
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ error: "Invalid Comment ID" });

  // Re-run moderation on edited text (Req #14)
  const validation = validateCommentContent(comment);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const target = await Comment.findById(id);
    if (!target) return res.status(404).json({ error: "Comment not found" });

    // Only owner can edit their own comment
    if (!target.userId.equals(new mongoose.Types.ObjectId(userId))) {
      return res.status(403).json({ error: "You can only edit your own comments" });
    }

    target.comment = comment;
    const saved = await target.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error("editComment error:", error);
    res.status(500).json({ error: "Failed to edit comment" });
  }
};

// ─────────────────────────────────────────────
// 7. DELETE /api/comments/:id  (Owner delete)
// ─────────────────────────────────────────────
export const deleteOwnComment = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: "userId is required" });
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ error: "Invalid Comment ID" });

  try {
    const target = await Comment.findById(id);
    if (!target) return res.status(404).json({ error: "Comment not found" });

    // Only owner can delete their own comment (not an admin route)
    if (!target.userId.equals(new mongoose.Types.ObjectId(userId))) {
      return res.status(403).json({ error: "You can only delete your own comments" });
    }

    await Comment.findByIdAndDelete(id);
    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("deleteOwnComment error:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
};

// ─────────────────────────────────────────────
// 8. POST /api/comments/:id/translate
// Server-side translation via MyMemory API + DB caching (Req #2)
// ─────────────────────────────────────────────
export const translateComment = async (req, res) => {
  const { id } = req.params;
  const { targetLang } = req.body;  // single declaration — no shadowing

  if (!targetLang) return res.status(400).json({ error: "targetLang is required" });
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ error: "Invalid Comment ID" });

  try {
    const target = await Comment.findById(id);
    if (!target) return res.status(404).json({ error: "Comment not found" });

    const sourceLang = (target.language || "en").toLowerCase();
    const destLang   = targetLang.toLowerCase();

    if (sourceLang === destLang) {
      return res.status(200).json({ translatedText: target.comment });
    }

    // Check DB cache first — avoid unnecessary API calls
    if (target.translatedComments && typeof target.translatedComments.get === "function") {
      const cached = target.translatedComments.get(destLang);
      if (cached) return res.status(200).json({ translatedText: cached });
    }

    // Call MyMemory Translation API from server (Req #2)
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(target.comment)}&langpair=${sourceLang}|${destLang}`
    );
    const data = await response.json();

    if (data.responseData && data.responseData.translatedText) {
      const translatedText = data.responseData.translatedText;

      // Cache translated result in DB for future requests
      if (!target.translatedComments) target.translatedComments = new Map();
      target.translatedComments.set(destLang, translatedText);
      await target.save();

      return res.status(200).json({ translatedText });
    } else {
      return res.status(500).json({ error: "Translation API returned an invalid response" });
    }
  } catch (error) {
    console.error("translateComment error:", error);
    res.status(500).json({ error: "Translation service is currently unavailable. Please try again later." });
  }
};

// ─────────────────────────────────────────────
// ADMIN APIs (protected via requireAdmin middleware in routes)
// ─────────────────────────────────────────────

// 9. GET /api/admin/reported-comments
export const getReportedComments = async (req, res) => {
  try {
    const reported = await Comment.find({ moderationStatus: "flagged" }).sort({ reports: -1 });
    res.status(200).json(reported);
  } catch (error) {
    console.error("getReportedComments error:", error);
    res.status(500).json({ error: "Failed to fetch reported comments" });
  }
};

// 10. PUT /api/admin/comments/:id/approve
export const approveComment = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ error: "Invalid Comment ID" });

  try {
    const target = await Comment.findById(id);
    if (!target) return res.status(404).json({ error: "Comment not found" });

    target.moderationStatus = "approved";
    target.reportReason     = null;
    target.reports          = 0;
    target.reportedBy       = [];  // Clear reporters after admin reviews

    const saved = await target.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error("approveComment error:", error);
    res.status(500).json({ error: "Failed to approve comment" });
  }
};

// 11. DELETE /api/admin/comments/:id (Admin force-delete)
export const deleteCommentAdmin = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ error: "Invalid Comment ID" });

  try {
    const result = await Comment.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: "Comment not found" });
    res.status(200).json({ message: "Comment successfully deleted by admin" });
  } catch (error) {
    console.error("deleteCommentAdmin error:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
};
