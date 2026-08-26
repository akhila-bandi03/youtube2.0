import video from "../Modals/video.js";
import User from "../Modals/Auth.js";
import { io } from "../index.js";
import { v2 as cloudinary } from "cloudinary";

// Initialize Cloudinary config (picks up process.env.CLOUDINARY_URL)
cloudinary.config();

export const uploadvideo = async (req, res) => {
  if (req.file === undefined) {
    return res
      .status(404)
      .json({ message: "plz upload a mp4 video file only" });
  } else {
    try {
      const file = new video({
        videotitle: req.body.videotitle,
        filename: req.file.originalname,
        filepath: req.file.path.replace(/\\/g, "/"), // Save local file path
        filetype: req.file.mimetype,
        filesize: req.file.size,
        videochanel: req.body.videochanel,
        uploader: req.body.uploader,
      });
      const savedVideo = await file.save();
      
      // Emit real-time event to all connected clients
      io.emit("new-video", savedVideo);

      return res.status(201).json("file uploaded successfully");
    } catch (error) {
      console.error(" error:", error);
      return res.status(500).json({ message: "Something went wrong" });
    }
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
    const secureFiles = files.map(file => {
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
