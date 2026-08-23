import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";

interface Comment {
  _id: string;
  videoid: string;
  userId: string;
  comment: string;
  username: string;
  avatar?: string;
  createdAt: string;
  updatedAt?: string;
  language?: string;
  likes?: number;
  dislikes?: number;
  reports?: number;
  reportReason?: string | null;
  location?: string | null;
  moderationStatus?: "approved" | "flagged" | "pending";
  likedBy?: string[];
  dislikedBy?: string[];
  reportedBy?: string[];
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  te: "Telugu",
  fr: "French",
  es: "Spanish",
  ja: "Japanese",
  hi: "Hindi",
  de: "German",
};

/** Maps comment language to a safe approximate region (never exact city — Req #4) */
const getApproximateRegion = (langCode: string): string => {
  const map: Record<string, string> = {
    en: "North America / Europe Region",
    fr: "Western Europe Region",
    es: "Latin America Region",
    ja: "East Asia Region",
    te: "South Asia Region",
    hi: "South Asia Region",
    de: "Central Europe Region",
  };
  return map[langCode] || "Global Region";
};

const Comments = ({ videoId }: { videoId: string }) => {
  const { user } = useUser();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  // New comment form
  const [newComment, setNewComment] = useState("");
  const [commentLang, setCommentLang] = useState("en");
  const [shareLocation, setShareLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Translation state
  const [preferredTargetLang, setPreferredTargetLang] = useState("te");
  const [translations, setTranslations] = useState<Record<string, { text: string; langName: string }>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translationErrors, setTranslationErrors] = useState<Record<string, string>>({});

  // Admin panel
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [flaggedComments, setFlaggedComments] = useState<Comment[]>([]);

  // ─────────────────────────────────────────────
  // Per-user state restored from DB (Req #15)
  // likedComments / dislikedComments / reportedComments are derived
  // from the DB arrays (likedBy / dislikedBy / reportedBy) so they
  // survive page refresh and work across different users.
  // ─────────────────────────────────────────────
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [dislikedComments, setDislikedComments] = useState<Set<string>>(new Set());
  const [reportedComments, setReportedComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadComments();
  }, [videoId]);

  useEffect(() => {
    if (isAdminOpen) loadFlaggedComments();
  }, [isAdminOpen]);

  // ─────────────────────────────────────────────
  // Load & restore per-user interaction state from DB (Req #13, #15)
  // ─────────────────────────────────────────────
  const loadComments = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/comments?videoid=${videoId}`);
      const data: Comment[] = res.data;
      setComments(data);

      // Restore liked / disliked / reported state from DB arrays for current user
      if (user?._id) {
        const liked    = new Set<string>();
        const disliked = new Set<string>();
        const reported = new Set<string>();

        data.forEach((c) => {
          if (c.likedBy?.includes(user._id))    liked.add(c._id);
          if (c.dislikedBy?.includes(user._id)) disliked.add(c._id);
          if (c.reportedBy?.includes(user._id)) reported.add(c._id);
        });

        setLikedComments(liked);
        setDislikedComments(disliked);
        setReportedComments(reported);
      }
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFlaggedComments = async () => {
    try {
      const res = await axiosInstance.get("/api/admin/reported-comments", {
        headers: { "x-user-id": user?._id || "admin" },
      });
      setFlaggedComments(res.data);
    } catch (error) {
      console.error("Failed to load flagged comments:", error);
    }
  };

  // ─────────────────────────────────────────────
  // Post Comment (Req #1, #5, #6, #7, #14)
  // ─────────────────────────────────────────────
  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;
    setIsSubmitting(true);

    const location = shareLocation ? getApproximateRegion(commentLang) : null;

    try {
      await axiosInstance.post("/api/comments", {
        userId:   user._id,
        videoid:  videoId,
        username: user.name || "Anonymous",
        avatar:   user.image || null,
        comment:  newComment.trim(),
        language: commentLang,
        location,
      });

      setNewComment("");
      setShareLocation(false);
      await loadComments();
    } catch (error: any) {
      const msg = error.response?.data?.error || "Failed to submit comment. Please try again.";
      alert(`⚠️ ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────
  // Edit Comment — uses new /api/comments/:id PUT with backend moderation (Req #14)
  // ─────────────────────────────────────────────
  const handleUpdateComment = async () => {
    if (!editText.trim() || !user) return;
    try {
      const res = await axiosInstance.put(`/api/comments/${editingCommentId}`, {
        userId:  user._id,
        comment: editText.trim(),
      });
      if (res.data) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === editingCommentId ? { ...c, comment: editText.trim() } : c
          )
        );
        setEditingCommentId(null);
        setEditText("");
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || "Edit failed. Content may have violated community guidelines.";
      alert(`⚠️ ${msg}`);
    }
  };

  // ─────────────────────────────────────────────
  // Delete Own Comment
  // ─────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await axiosInstance.delete(`/api/comments/${id}`, {
        data: { userId: user._id },
      });
      setComments((prev) => prev.filter((c) => c._id !== id));
      if (isAdminOpen) loadFlaggedComments();
    } catch (error: any) {
      const msg = error.response?.data?.error || "Could not delete comment.";
      alert(`⚠️ ${msg}`);
    }
  };

  // ─────────────────────────────────────────────
  // Like — server-side dedup, persists across refresh (Req #8, #13, #15)
  // ─────────────────────────────────────────────
  const handleLike = async (commentId: string) => {
    if (!user) return alert("Please log in to like comments.");

    try {
      const res = await axiosInstance.put(`/api/comments/${commentId}/like`, {
        userId: user._id,
      });

      const { likes, dislikes, userHasLiked, userHasDisliked } = res.data;

      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId ? { ...c, likes, dislikes } : c
        )
      );

      setLikedComments((prev) => {
        const next = new Set(prev);
        userHasLiked ? next.add(commentId) : next.delete(commentId);
        return next;
      });

      if (!userHasDisliked) {
        setDislikedComments((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    } catch (err: any) {
      console.error("Like error:", err);
    }
  };

  // ─────────────────────────────────────────────
  // Dislike — server-side dedup, persists across refresh (Req #9, #12, #13, #15)
  // ─────────────────────────────────────────────
  const handleDislike = async (commentId: string) => {
    if (!user) return alert("Please log in to dislike comments.");

    try {
      const res = await axiosInstance.put(`/api/comments/${commentId}/dislike`, {
        userId: user._id,
      });

      const { likes, dislikes, userHasLiked, userHasDisliked } = res.data;

      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId ? { ...c, likes, dislikes } : c
        )
      );

      setDislikedComments((prev) => {
        const next = new Set(prev);
        userHasDisliked ? next.add(commentId) : next.delete(commentId);
        return next;
      });

      if (!userHasLiked) {
        setLikedComments((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    } catch (err: any) {
      console.error("Dislike error:", err);
    }
  };

  // ─────────────────────────────────────────────
  // Report — server-side dedup (Req #10, #11, #15)
  // ─────────────────────────────────────────────
  const handleReport = async (commentId: string) => {
    if (!user) return alert("Please log in to report comments.");
    if (reportedComments.has(commentId)) {
      return alert("You have already reported this comment.");
    }

    const reasons = [
      "Inappropriate language",
      "Spam or promotion",
      "Harassment / Abuse",
      "Off-topic content",
      "Misinformation",
    ];

    let promptMsg = "Why are you reporting this comment?\n";
    reasons.forEach((r, idx) => { promptMsg += `${idx + 1}. ${r}\n`; });

    const choice = prompt(promptMsg, "1");
    if (choice === null) return;

    const idx    = parseInt(choice) - 1;
    const reason = reasons[idx] || "Other issues";

    try {
      const res = await axiosInstance.post(`/api/comments/${commentId}/report`, {
        userId: user._id,
        reason,
      });

      if (res.data) {
        setReportedComments((prev) => new Set([...prev, commentId]));
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? { ...c, reports: res.data.reports, moderationStatus: "flagged", reportReason: reason }
              : c
          )
        );
        alert("✅ This comment has been flagged for admin review.");
        if (isAdminOpen) loadFlaggedComments();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to report comment.";
      alert(`⚠️ ${msg}`);
    }
  };

  // ─────────────────────────────────────────────
  // Translate — via backend MyMemory API + DB cache (Req #2)
  // ─────────────────────────────────────────────
  const handleTranslate = async (comment: Comment) => {
    // Toggle off if already translated
    if (translations[comment._id]) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[comment._id];
        return next;
      });
      return;
    }

    const sourceLang = comment.language || "en";
    if (sourceLang === preferredTargetLang) {
      setTranslationErrors((prev) => ({
        ...prev,
        [comment._id]: `Comment is already in ${LANG_NAMES[preferredTargetLang] || preferredTargetLang}.`,
      }));
      return;
    }

    setTranslatingId(comment._id);
    setTranslationErrors((prev) => { const n = { ...prev }; delete n[comment._id]; return n; });

    try {
      const res = await axiosInstance.post(`/api/comments/${comment._id}/translate`, {
        targetLang: preferredTargetLang,
      });

      if (res.data?.translatedText) {
        setTranslations((prev) => ({
          ...prev,
          [comment._id]: {
            text:     res.data.translatedText,
            langName: LANG_NAMES[preferredTargetLang] || preferredTargetLang,
          },
        }));
      }
    } catch (err: any) {
      setTranslationErrors((prev) => ({
        ...prev,
        [comment._id]: "Translation service is unavailable. Please try again.",
      }));
    } finally {
      setTranslatingId(null);
    }
  };

  // ─────────────────────────────────────────────
  // Admin Actions (Req #11)
  // ─────────────────────────────────────────────
  const handleAdminApprove = async (commentId: string) => {
    try {
      await axiosInstance.put(
        `/api/admin/comments/${commentId}/approve`,
        { userId: user?._id },
        { headers: { "x-user-id": user?._id || "admin" } }
      );
      await loadComments();
      await loadFlaggedComments();
    } catch (err) {
      console.error("Approve error:", err);
    }
  };

  const handleAdminDelete = async (commentId: string) => {
    try {
      await axiosInstance.delete(`/api/admin/comments/${commentId}`, {
        headers: { "x-user-id": user?._id || "admin" },
      });
      setFlaggedComments((prev) => prev.filter((c) => c._id !== commentId));
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      console.error("Admin delete error:", err);
    }
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (loading) {
    return <div className="text-gray-500 italic py-6 text-center animate-pulse">Loading comments...</div>;
  }

  return (
    <div className="space-y-6 text-slate-800 bg-transparent">
      {/* Header row */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <h2 className="text-lg font-bold text-slate-850">{comments.length} Comments</h2>
        <div className="flex items-center gap-3">
          {/* Global translation target language (Req #2) */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Translate to:</span>
            <select
              value={preferredTargetLang}
              onChange={(e) => setPreferredTargetLang(e.target.value)}
              className="bg-white border border-slate-300 text-slate-700 rounded px-2 py-1 outline-none text-xs"
            >
              <option value="te">Telugu (తెలుగు)</option>
              <option value="en">English</option>
              <option value="fr">French (Français)</option>
              <option value="es">Spanish (Español)</option>
              <option value="ja">Japanese (日本語)</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="de">German (Deutsch)</option>
            </select>
          </div>

          {/* Admin console toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdminOpen(!isAdminOpen)}
            className="border-red-500/40 bg-red-950/10 hover:bg-red-950/30 text-red-400 font-semibold text-xs"
          >
            🛡️ Admin Console ({flaggedComments.length})
          </Button>
        </div>
      </div>

      {/* Admin Console — Flagged comments for moderator review (Req #11) */}
      {isAdminOpen && (
        <div className="bg-slate-950/80 border-2 border-red-500/20 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-md font-semibold text-red-400">🛡️ Flagged Comments — Awaiting Review</h3>
            <span className="text-xs text-slate-500">Reported comments are NEVER auto-deleted (Req #12)</span>
          </div>
          {flaggedComments.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-2">No flagged comments. ✨</p>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {flaggedComments.map((c) => (
                <div
                  key={c._id}
                  className="flex justify-between items-start text-xs bg-slate-900 p-3 rounded border border-slate-800 gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="truncate">
                      <strong className="text-slate-300">{c.username}</strong>:{" "}
                      <span className="text-slate-400 italic">"{c.comment}"</span>
                    </div>
                    <div className="text-[10px] text-red-400">
                      Reason: {c.reportReason || "Flagged"} &bull; Reports: {c.reports || 1}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {c.createdAt ? formatDistanceToNow(new Date(c.createdAt)) + " ago" : ""}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleAdminApprove(c._id)}
                      className="bg-green-600 hover:bg-green-700 text-white text-[10px] py-1 px-2.5 h-auto"
                    >
                      ✅ Approve
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAdminDelete(c._id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-[10px] py-1 px-2.5 h-auto"
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post new comment (Req #1, #3, #4) */}
      {user ? (
        <div className="flex gap-4">
          <Avatar className="w-10 h-10 ring-2 ring-violet-500/20">
            <AvatarImage src={user.image || ""} />
            <AvatarFallback className="bg-violet-950 text-violet-300 font-semibold">
              {user.name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="Add a respectful comment... (abusive words, spam, and excessive symbols are auto-blocked)"
              value={newComment}
              onChange={(e: any) => setNewComment(e.target.value)}
              className="min-h-[80px] bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm"
            />

            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-4 text-xs">
                {/* Language selector (Req #1) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Language:</span>
                  <select
                    value={commentLang}
                    onChange={(e) => setCommentLang(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-700 rounded px-2 py-1 outline-none text-xs"
                  >
                    <option value="en">English</option>
                    <option value="te">Telugu (తెలుగు)</option>
                    <option value="fr">French (Français)</option>
                    <option value="es">Spanish (Español)</option>
                    <option value="ja">Japanese (日本語)</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="de">German (Deutsch)</option>
                  </select>
                </div>

                {/* Optional location sharing — approximate region only (Req #4) */}
                <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={shareLocation}
                    onChange={(e) => setShareLocation(e.target.checked)}
                    className="accent-violet-600 rounded"
                  />
                  <span>Share Approximate Region 🔒</span>
                </label>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => { setNewComment(""); setShareLocation(false); }}
                  disabled={!newComment.trim()}
                  className="text-slate-600 hover:text-slate-900 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm"
                >
                  {isSubmitting ? "Posting..." : "Comment"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic text-center py-2">
          Please log in to post a comment.
        </p>
      )}

      {/* Comments feed (Req #3, #8, #9, #10, #11, #13, #15) */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-4">
            No comments yet. Be the first to start the discussion!
          </p>
        ) : (
          comments.map((comment) => {
            const isLiked    = likedComments.has(comment._id);
            const isDisliked = dislikedComments.has(comment._id);
            const isReported = comment.moderationStatus === "flagged";
            const translation     = translations[comment._id];
            const translationError = translationErrors[comment._id];
            const isOwner    = comment.userId === user?._id;

            return (
              <div
                key={comment._id}
                className={`flex gap-4 p-3 rounded-xl transition border ${
                  isReported
                    ? "border-red-900/50 bg-red-950/5"
                    : "border-transparent hover:bg-slate-900/20 hover:border-slate-800/30"
                }`}
              >
                {/* Avatar */}
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={comment.avatar || "/placeholder.svg?height=40&width=40"} />
                  <AvatarFallback className="bg-slate-800 text-slate-300 font-semibold">
                    {comment.username?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-1.5 min-w-0">
                  {/* Username + time + language badge + location (Req #3, #4) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">{comment.username}</span>
                    <span className="text-xs text-slate-500">
                      {comment.createdAt
                        ? formatDistanceToNow(new Date(comment.createdAt)) + " ago"
                        : "just now"}
                    </span>
                    <span className="text-[10px] bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded font-mono uppercase">
                      {comment.language || "en"}
                    </span>
                    {/* Location shown ONLY if user opted in — never exact city (Req #4) */}
                    {comment.location && (
                      <span className="text-xs text-violet-500 flex items-center gap-1 font-medium">
                        📍 {comment.location}
                      </span>
                    )}
                  </div>

                  {/* Flagged badge (Req #11) */}
                  {isReported && (
                    <div className="bg-red-950/30 text-red-400 border border-red-900/40 rounded px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1.5">
                      ⚠️ Under review — Flagged for "{comment.reportReason || "Review"}"
                    </div>
                  )}

                  {/* Edit mode */}
                  {editingCommentId === comment._id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="bg-slate-950 text-white border border-slate-700 focus:border-violet-500 focus:ring-0 text-sm"
                      />
                      <p className="text-[10px] text-slate-500">
                        ℹ️ Edited content is re-validated for policy violations before saving.
                      </p>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          onClick={() => { setEditingCommentId(null); setEditText(""); }}
                          className="text-sm"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleUpdateComment}
                          disabled={!editText.trim()}
                          className="bg-violet-600 hover:bg-violet-700 text-white text-sm"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Comment text */}
                      <p className={`text-sm text-slate-800 break-words ${isReported ? "opacity-70" : ""}`}>
                        {comment.comment}
                      </p>

                      {/* Translation states (Req #2) */}
                      {translatingId === comment._id && (
                        <div className="text-xs text-violet-500 italic animate-pulse py-1">
                          Translating...
                        </div>
                      )}
                      {translationError && (
                        <div className="text-xs text-red-500 py-1 font-medium">⚠️ {translationError}</div>
                      )}
                      {translation && (
                        <div className="bg-violet-50 border-l-4 border-violet-500 p-2.5 rounded-r my-1.5 text-xs">
                          <div className="text-[10px] text-violet-600 font-semibold mb-0.5">
                            🌐 Translated to {translation.langName}
                          </div>
                          <div className="text-slate-700 italic">"{translation.text}"</div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Like (Req #8) */}
                          <button
                            onClick={() => handleLike(comment._id)}
                            title="Like this comment"
                            className={`flex items-center gap-1.5 hover:text-green-500 transition-all duration-150 active:scale-90 ${
                              isLiked ? "text-green-500 font-bold" : ""
                            }`}
                          >
                            <span className="text-base">👍</span>
                            <span>{comment.likes || 0}</span>
                          </button>

                          {/* Dislike (Req #9) — never auto-deletes comment (Req #12) */}
                          <button
                            onClick={() => handleDislike(comment._id)}
                            title="Dislike this comment"
                            className={`flex items-center gap-1.5 hover:text-red-400 transition-all duration-150 active:scale-90 ${
                              isDisliked ? "text-red-400 font-bold" : ""
                            }`}
                          >
                            <span className="text-base">👎</span>
                            <span>{comment.dislikes || 0}</span>
                          </button>

                          {/* Report (Req #10) */}
                          <button
                            onClick={() => handleReport(comment._id)}
                            disabled={isReported || reportedComments.has(comment._id)}
                            title={reportedComments.has(comment._id) ? "Already reported" : "Report this comment"}
                            className={`flex items-center gap-1 transition-all duration-150 hover:text-amber-500 ${
                              isReported || reportedComments.has(comment._id)
                                ? "text-amber-500 opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <span>🚩</span>
                            <span>{isReported ? "Flagged" : reportedComments.has(comment._id) ? "Reported" : "Report"}</span>
                          </button>

                          {/* Translate (Req #2) */}
                          <button
                            onClick={() => handleTranslate(comment)}
                            disabled={translatingId === comment._id}
                            title="Translate this comment"
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-900/20 border border-violet-500/30 text-violet-400 rounded-full hover:bg-violet-900/40 hover:text-violet-200 font-medium transition-all duration-150 text-[11px]"
                          >
                            🌐 {translation ? "Hide" : "Translate"}
                          </button>
                        </div>

                        {/* Owner actions (Edit/Delete) */}
                        {isOwner && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => { setEditingCommentId(comment._id); setEditText(comment.comment); }}
                              className="hover:text-slate-300 transition text-[11px]"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDelete(comment._id)}
                              className="hover:text-red-400 transition text-[11px]"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Comments;
