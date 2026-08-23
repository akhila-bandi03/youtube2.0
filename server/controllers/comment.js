import comment from "../Modals/comment.js";
import mongoose from "mongoose";

// Moderation word lists
const BANNED_WORDS = ['badword', 'idiot', 'moron', 'jerk', 'abuse', 'spam', 'scam', 'fudge', 'bastard'];
const SPAM_PHRASES = ['buy now', 'free money', 'click here', 'make money fast', 'crypto riches', 'get rich quick'];

function validateCommentText(text) {
  const textLower = text.toLowerCase();

  // 1. Abusive words check
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(textLower)) {
      return { valid: false, error: `Inappropriate language detected. The word "${word}" is not allowed in our community.` };
    }
  }

  // 2. Spam phrases check
  for (const phrase of SPAM_PHRASES) {
    if (textLower.includes(phrase)) {
      return { valid: false, error: `Spam-like content detected. Refrain from posting promotional catchphrases.` };
    }
  }

  // 3. Spam link check
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  if (urlPattern.test(text)) {
    return { valid: false, error: "External links are not allowed in comments to prevent phishing and spam." };
  }

  // 4. Repeated special characters check
  const repeatedSpecialChars = /([!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`\-])\1{3,}/g;
  if (repeatedSpecialChars.test(text)) {
    return { valid: false, error: "Comment contains excessive repeated special characters. Please write a meaningful message." };
  }

  return { valid: true };
}

export const postcomment = async (req, res) => {
  const { userid, videoid, commentbody, usercommented, lang, location } = req.body;
  
  if (!commentbody || !userid || !videoid) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // Server-side moderation check
  const validation = validateCommentText(commentbody);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const postcomment = new comment({
    userid,
    videoid,
    commentbody,
    usercommented,
    lang: lang || "en",
    location: location || null
  });

  try {
    const saved = await postcomment.save();
    return res.status(200).json(saved);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getallcomment = async (req, res) => {
  const { videoid } = req.params;
  try {
    const commentvideo = await comment.find({ videoid: videoid });
    return res.status(200).json(commentvideo);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const deletecomment = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    await comment.findByIdAndDelete(_id);
    return res.status(200).json({ comment: true });
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const editcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { commentbody } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    const updatecomment = await comment.findByIdAndUpdate(_id, {
      $set: { commentbody: commentbody },
    }, { new: true });
    res.status(200).json(updatecomment);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Like / Upvote Comment
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
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Dislike / Downvote Comment
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
    targetComment.dislikes = Math.max(0, targetComment.dislikes);

    const saved = await targetComment.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Report / Flag Comment
export const reportcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { reason } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    const targetComment = await comment.findById(_id);
    if (!targetComment) return res.status(404).send("comment not found");

    targetComment.reported = true;
    targetComment.reportReason = reason;

    const saved = await targetComment.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: Get all flagged comments
export const getflaggedcomments = async (req, res) => {
  try {
    const flagged = await comment.find({ reported: true });
    res.status(200).json(flagged);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: Approve / Clear report flag
export const approvecomment = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    const targetComment = await comment.findById(_id);
    if (!targetComment) return res.status(404).send("comment not found");

    targetComment.reported = false;
    targetComment.reportReason = null;

    const saved = await targetComment.save();
    res.status(200).json(saved);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
