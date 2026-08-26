import express from "express";
import { getallvideo, uploadvideo, savevideo } from "../controllers/video.js";
import upload from "../filehelper/filehelper.js";

const routes = express.Router();

routes.post("/upload", upload.single("file"), uploadvideo); // legacy (local only)
routes.post("/save", savevideo);                             // new: frontend → Cloudinary → this
routes.get("/getall", getallvideo);
export default routes;
