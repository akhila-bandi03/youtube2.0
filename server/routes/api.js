import express from "express";
import {
  getComments,
  postComment,
  likeComment,
  dislikeComment,
  reportComment,
  editComment,
  deleteOwnComment,
  translateComment,
  getReportedComments,
  approveComment,
  deleteCommentAdmin,
} from "../controllers/apiComment.js";

import {
  createDownload,
  getDownloadsByUserId
} from "../controllers/download.js";

import {
  createOrder,
  verifyPayment
} from "../controllers/payment.js";

const router = express.Router();

// ─────────────────────────────────────────────
// Admin Auth Middleware
// Checks that x-user-id header is present.
// For full production security, verify against DB that user has admin role.
// ─────────────────────────────────────────────
const requireAdmin = async (req, res, next) => {
  const userId = req.headers["x-user-id"] || req.body?.userId || req.params?.userId || req.query?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: Admin access required" });
  }
  // Attach userId to request for downstream use
  req.adminUserId = userId;
  next();
};

const requireAuth = async (req, res, next) => {
  const userId = req.headers["x-user-id"] || req.body?.userId || req.params?.userId || req.query?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: Please log in" });
  }
  // Optional: could verify if user exists in DB here
  next();
};

// ─────────────────────────────────────────────
// Public Comment APIs (Req #1–#15)
// ─────────────────────────────────────────────
router.get("/comments", getComments);                         // GET all comments for a video
router.post("/comments", postComment);                        // POST new comment (validated server-side)
router.put("/comments/:id/like", likeComment);                // PUT like (server-side dedup)
router.put("/comments/:id/dislike", dislikeComment);          // PUT dislike (server-side dedup)
router.post("/comments/:id/report", reportComment);           // POST report (server-side dedup, flags for review)
router.put("/comments/:id", editComment);                     // PUT edit own comment (re-validates content)
router.delete("/comments/:id", deleteOwnComment);             // DELETE own comment (owner only)
router.post("/comments/:id/translate", translateComment);     // POST translate via MyMemory API

// ─────────────────────────────────────────────
// Admin Moderation APIs (protected — requireAdmin middleware)
// ─────────────────────────────────────────────
router.get("/admin/reported-comments", requireAdmin, getReportedComments);        // GET all flagged
router.put("/admin/comments/:id/approve", requireAdmin, approveComment);          // PUT approve/clear
router.delete("/admin/comments/:id", requireAdmin, deleteCommentAdmin);           // DELETE admin force-delete

// ─────────────────────────────────────────────
// Download Control APIs
// ─────────────────────────────────────────────
router.post("/downloads", requireAuth, createDownload);
router.get("/downloads/:userId", requireAuth, getDownloadsByUserId);

// ─────────────────────────────────────────────
// Payment APIs
// ─────────────────────────────────────────────
router.post("/payments/order", requireAuth, createOrder);
router.post("/payments/verify", requireAuth, verifyPayment);

export default router;
