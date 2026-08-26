"use strict";
import multer from "multer";

// Use memory storage instead of disk storage — Vercel serverless has no
// persistent filesystem, so we buffer the file in memory and upload to
// Cloudinary from the controller.
const storage = multer.memoryStorage();

const filefilter = (req, file, cb) => {
  // Accept all video types (mp4, webm, mov, avi, etc.)
  if (file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// 200 MB limit — large enough for most uploads; Vercel free tier caps at 4.5 MB
// body but Vercel Pro / self-hosted removes that restriction.
const upload = multer({
  storage: storage,
  fileFilter: filefilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

export default upload;
