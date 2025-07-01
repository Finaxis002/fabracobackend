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
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
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
      return res.status(400).json({ message: "Failed reCAPTCHA validation" });
    }

    // Handle admin login
    if (isAdminLogin) {
      const admin = await Admin.findOne({ adminId: userId });

      if (!admin || !(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      const token = jwt.sign(
        { id: admin._id, role: admin.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

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

    // Handle regular user login (existing code)
    const user = await User.findOne({ userId }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid user ID or password" });
    }

     if (isAdminLogin && user.role !== "Admin") {
    return res.status(401).json({ message: "Not an admin account" });
  }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

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
