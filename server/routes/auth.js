import express from "express";
import { login, updateprofile, verifyOtp, updateTheme, updatePlan } from "../controllers/auth.js";
const routes = express.Router();

routes.post("/login", login);
routes.post("/verify-otp", verifyOtp);
routes.put("/theme", updateTheme);
routes.patch("/update/:id", updateprofile);
routes.patch("/plan/:id", updatePlan);  // Plan toggle — persists to DB
export default routes;
