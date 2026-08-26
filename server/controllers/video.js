import video from "../Modals/video.js";
import User from "../Modals/Auth.js";
import { io } from "../index.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// Initialize Cloudinary config (reads CLOUDINARY_URL from process.env automatically)
cloudinary.config();

/**
 * Upload a video buffer to Cloudinary using a stream (works in serverless).
 * Returns the upload result object.
 */
const uploadToCloudinary = (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    const publicId = `youtube_videos/${Date.now()}-${originalname.replace(/\.[^.]+$/, "").replace(/\s+/g, "_")}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        public_id: publicId,
        chunk_size: 6000000, // 6 MB chunks for reliable large-file uploads
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export const uploadvideo = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ message: "Please upload a valid video file." });
  }

  try {
    // Upload buffer → Cloudinary
    const cloudinaryResult = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname
    );

    const file = new video({
      videotitle: req.body.videotitle,
      filename: req.file.originalname,
      filepath: cloudinaryResult.secure_url, // ← Cloudinary HTTPS URL
      filetype: req.file.mimetype,
      filesize: String(req.file.size),
      videochanel: req.body.videochanel,
      uploader: req.body.uploader,
    });

    const savedVideo = await file.save();

    // Emit real-time event to all connected clients
    io.emit("new-video", savedVideo);

    return res.status(201).json("file uploaded successfully");
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Something went wrong during upload." });
  }
};

export const getallvideo = async (req, res) => {
  try {
    const files = await video.find();

    // Check if user is authenticated via x-user-id header
    const userId = req.headers["x-user-id"];
    let isUserPremium = false;

    if (userId) {
      const user = await User.findById(userId);
      if (user && ["bronze", "silver", "gold", "premium"].includes(user.plan)) {
        isUserPremium = true;
      }
    }

    // Strip filepath for premium videos if user is not premium (Req #12 backend enforcement)
    const secureFiles = files.map((file) => {
      const fileObj = file.toObject();
      if (fileObj.isPremium && !isUserPremium) {
        // Obfuscate filepath so it cannot be directly accessed or downloaded
        fileObj.filepath = "premium-locked";
      }
      return fileObj;
    });

    return res.status(200).send(secureFiles);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
