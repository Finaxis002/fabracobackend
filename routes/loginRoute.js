const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const router = express.Router();
const User = require("../models/User");
const Admin = require("../models/Admin");
const axios = require("axios");

router.post("/login", async (req, res) => {
  const { userId, password, isAdminLogin, recaptchaToken } = req.body;
  console.log(
    `Login attempt: userId=${userId}, isAdminLogin=${isAdminLogin}, ip=${
      req.ip
    }, time=${new Date().toISOString()}`
  );

  try {
    // Validate reCAPTCHA - skip if manual captcha is used
    if (recaptchaToken === "manual-captcha-verified") {
      console.log("✅ Manual CAPTCHA verified, skipping Google reCAPTCHA");
    } else if (recaptchaToken) {
      // Only verify with Google if it's NOT manual captcha
      const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;

      try {
        const verifyRes = await axios.post(
          `https://www.google.com/recaptcha/api/siteverify`,
          null,
          {
            params: {
              secret: recaptchaSecret,
              response: recaptchaToken,
            },
          }
        );

        if (!verifyRes.data.success) {
          console.log("reCAPTCHA failed:", verifyRes.data);
          return res
            .status(400)
            .json({ message: "Failed reCAPTCHA validation" });
        }
      } catch (recaptchaErr) {
        console.error("reCAPTCHA verification error:", recaptchaErr);
        return res.status(400).json({ message: "CAPTCHA verification failed" });
      }
    } else {
      // No captcha token provided
      return res.status(400).json({ message: "CAPTCHA token required" });
    }

    // Handle admin login
    if (isAdminLogin) {
      const admin = await Admin.findOne({ adminId: userId });

      if (!admin) {
        console.log(`Admin not found: ${userId}`);
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        console.log(`Invalid password for admin: ${userId}`);
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      const token = jwt.sign(
        { id: admin._id, role: admin.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      console.log(`Admin login successful: ${userId}`);

      return res.json({
        token,
        role: admin.role,
        user: {
          _id: admin._id,
          name: admin.name,
          userId: admin.adminId,
        },
      });
    }

    // Handle regular user login
    const user = await User.findOne({ userId }).select("+password");

    if (!user) {
      console.log(`User not found: ${userId}`);
      return res.status(401).json({ message: "Invalid user ID or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`Invalid password for user: ${userId}`);
      return res.status(401).json({ message: "Invalid user ID or password" });
    }

    // Check if trying to login as admin but user is not an admin
    if (isAdminLogin && user.role !== "Admin") {
      console.log(`Non-admin user tried admin login: ${userId}`);
      return res.status(401).json({ message: "Not an admin account" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`User login successful: ${userId}, role: ${user.role}`);

    res.json({
      token,
      role: user.role,
      user: {
        _id: user._id,
        name: user.name,
        userId: user.userId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

module.exports = router;
