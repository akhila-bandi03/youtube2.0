import express from "express";
import { 
  deletecomment, 
  getallcomment, 
  postcomment, 
  editcomment,
  likecomment,
  dislikecomment,
  reportcomment,
  getflaggedcomments,
  approvecomment
} from "../controllers/comment.js";

const routes = express.Router();
routes.get("/flagged", getflaggedcomments);
routes.get("/:videoid", getallcomment);
routes.post("/postcomment", postcomment);
routes.delete("/deletecomment/:id", deletecomment);
routes.post("/editcomment/:id", editcomment);
routes.put("/:id/like", likecomment);
routes.put("/:id/dislike", dislikecomment);
routes.put("/:id/report", reportcomment);
routes.put("/:id/approve", approvecomment);

export default routes;
