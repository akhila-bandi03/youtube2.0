import mongoose from "mongoose";
import users from "../Modals/Auth.js";
import nodemailer from "nodemailer";

// Helper to generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getISTHour() {
  const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const istHourStr = formatter.format(new Date());
  return parseInt(istHourStr, 10);
}

// 1. POST /user/login
export const login = async (req, res) => {
  const { email, name, image, location, device } = req.body;

  try {
    const existingUser = await users.findOne({ email });

    if (!existingUser) {
      // New user registration
      const hour = getISTHour();
      const selectedTheme = (hour >= 10 && hour < 12) ? "light" : "dark";
      const newUser = await users.create({ 
        email, 
        name, 
        image,
        lastLocation: location || "Unknown Region",
        lastDevice: device || "Unknown Device",
        theme: selectedTheme
      });
      return res.status(201).json({ result: newUser });
    } else {
      // Existing user login check
      const currentLoc = location || "Unknown Region";
      // Use simplified device from frontend (just browser name like "Chrome Browser")
      const currentDev = device || req.headers["user-agent"] || "Unknown Device";

      // Only trigger OTP if location OR device has meaningfully changed.
      // Mobile browsers often report platform-specific variations, so normalize before comparing.
      const isNewLocation = !!existingUser.lastLocation && normalizeText(existingUser.lastLocation) !== normalizeText(currentLoc);
      const isNewDevice = !!existingUser.lastDevice && normalizeText(existingUser.lastDevice) !== normalizeText(currentDev);

      if (isNewLocation || isNewDevice) {
        const otp = generateOTP();
        existingUser.otpCode = otp;
        existingUser.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry
        existingUser.otpAttempts = 0; // Reset attempts
        await existingUser.save();

        try {
          let transporter;
          const emailUser = process.env.EMAIL_USER;
          const emailPass = process.env.EMAIL_PASS;

          if (emailUser && emailPass) {
            transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: emailUser,
                pass: emailPass,
              },
            });
          } else {
            let testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
              host: "smtp.ethereal.email",
              port: 587,
              secure: false,
              auth: { user: testAccount.user, pass: testAccount.pass },
            });
          }

          const info = await transporter.sendMail({
            from: emailUser ? `"YourTubeIN Security" <${emailUser}>` : '"YourTubeIN Security" <security@yourtube.in>',
            to: email,
            subject: "Your Login Verification Code",
            html: `<p>We detected a login attempt from a new device or location.</p><p>Your OTP is: <strong>${otp}</strong> (Expires in 5 minutes)</p>`,
          });

          if (emailUser && emailPass) {
            console.log(`[OTP Email Sent] Real email delivered to: ${email}`);
          } else {
            console.log(`[OTP Email Sent] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
          }
        } catch (mailErr) {
          console.error("Failed to send OTP email:", mailErr);
        }

        return res.status(200).json({ 
          requiresOtp: true, 
          userId: existingUser._id, 
          message: "Security Notice: Login detected from a new location or device. We have emailed you an OTP." 
        });
      }

      // Same location/device: proceed to login and ensure fields are populated
      if (!existingUser.lastLocation) existingUser.lastLocation = currentLoc;
      if (!existingUser.lastDevice) existingUser.lastDevice = currentDev;
      const hour = getISTHour();
      existingUser.theme = (hour >= 10 && hour < 12) ? "light" : "dark";
      await existingUser.save();

      return res.status(200).json({ result: existingUser });
    }
  } catch (error) {
    console.error("Login error:", error?.message || error);
    return res.status(500).json({ message: error?.message || "Something went wrong" });
  }
};

// 2. POST /user/verify-otp
export const verifyOtp = async (req, res) => {
  const { userId, otpCode, location, device } = req.body;

  if (!userId || !otpCode) {
    return res.status(400).json({ error: "UserId and OTP code are required" });
  }

  try {
    const user = await users.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Rate limiting: Max 3 attempts
    if (user.otpAttempts >= 3) {
      return res.status(403).json({ error: "Account locked due to too many failed OTP attempts. Please login again." });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: "OTP code has expired. Please try logging in again." });
    }

    // Validate OTP securely (No bypass)
    if (!user.otpCode || user.otpCode !== otpCode) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ error: `Invalid OTP code. Attempts remaining: ${3 - user.otpAttempts}` });
    }

    // Success: clear OTP, record new location and device as authorized
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.lastLocation = location || user.lastLocation;
    user.lastDevice = device || req.headers["user-agent"] || user.lastDevice;
    const hour = getISTHour();
    user.theme = (hour >= 10 && hour < 12) ? "light" : "dark";
    await user.save();

    res.status(200).json({ success: true, result: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error during OTP check" });
  }
};

// 3. PUT /user/theme
export const updateTheme = async (req, res) => {
  const { userId, theme } = req.body;

  if (!userId || !theme || !["light", "dark"].includes(theme)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  try {
    const user = await users.findByIdAndUpdate(
      userId,
      { theme },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json({ success: true, theme: user.theme });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update theme profile preference" });
  }
};

// 4. PATCH /user/update/:id
export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { channelname, description } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(500).json({ message: "User unavailable..." });
  }
  try {
    const updatedata = await users.findByIdAndUpdate(
      _id,
      {
        $set: {
          channelname: channelname,
          description: description,
        },
      },
      { new: true }
    );
    return res.status(201).json(updatedata);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// 5. PATCH /user/plan/:id — update user subscription plan (persists to DB)
export const updatePlan = async (req, res) => {
  const { id: _id } = req.params;
  const { plan } = req.body;

  const validPlans = ["free", "bronze", "silver", "gold", "premium"];
  if (!plan || !validPlans.includes(plan)) {
    return res.status(400).json({ error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` });
  }
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }
  try {
    const updated = await users.findByIdAndUpdate(
      _id,
      { $set: { plan } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ success: true, plan: updated.plan });
  } catch (error) {
    console.error("updatePlan error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
