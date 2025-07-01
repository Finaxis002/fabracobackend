const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "shardaassociates.in@gmail.com",
    pass: "ullq uygv ynkk rfsi", // ✔️ Use a Gmail app password here!
  },
});

// RESET PASSWORD (Super Admin)
router.post("/reset-password", async (req, res) => {
  try {
    const { adminId, newPassword } = req.body;

    // Find Admin by adminId
    // const admin = await Admin.findOne({ adminId });
    const admin = await Admin.findById("68271c74487f3a8ea0dd6bdd");

    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // Validate new password
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: "New password too short" });

    // Update password (will be hashed by pre('save'))
    admin.password = newPassword;
    await admin.save();

    // Email details
    const username = admin.adminId;
    const mailOptions = {
      from: '"FCA Software" <shardaassociates.in@gmail.com>',
      to: "caanunaysharda@gmail.com",
      subject: "🔐 Admin Password Changed - FCA  Software Notification",
      text: `The admin password for ${username} has been changed successfully.`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #4f46e5; padding: 20px;">
              <h2 style="color: #ffffff; margin: 0;">🔐 Password Changed</h2>
              <p style="color: #e0e7ff; margin: 5px 0 0;">Admin Notification - FCa Software</p>
            </div>
            <div style="padding: 20px;">
              <p>Dear Admin,</p>
              <p>This is to inform you that the password for the admin account <strong>(${username})</strong> has been successfully changed.</p>
              <table style="margin-top: 20px; width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; background-color: #f9fafb; border: 1px solid #e5e7eb;"><strong>Username</strong></td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb;">${username}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; background-color: #f9fafb; border: 1px solid #e5e7eb;"><strong>New Password</strong></td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb;">${newPassword}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; background-color: #f9fafb; border: 1px solid #e5e7eb;"><strong>Changed At</strong></td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
              <p style="margin-top: 20px;">If you did not initiate this change, please contact the system administrator immediately.</p>
              <p style="margin-top: 20px;">Regards,<br/><strong>FCA Software Team</strong></p>
            </div>
            <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              This is an automated message from FCA Software. Please do not reply to this email.
            </div>
          </div>
        </div>
      `,
    };

    // Send the email
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        // Password changed, but mail failed
        return res.json({
          message: "Password updated, but email notification failed.",
          emailError: err.message,
        });
      } else {
        return res.json({
          message: "Password updated successfully and notification sent.",
        });
      }
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
});

module.exports = router;
