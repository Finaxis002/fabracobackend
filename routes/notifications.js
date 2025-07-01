// routes/notifications.js
const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { authMiddleware } = require("../middleware/auth"); // Add auth middleware as per your app

router.post("/send", async (req, res) => {
  const { token, title, body } = req.body;

  if (!token || !title || !body) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const result = await sendNotification(token, title, body);

  if (!result.success) {
    return res.status(500).json({ error: "Failed to send notification" });
  }

  res.json({ success: true });
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    let filter = {};

    const role = (req.userRole || req.user.role || "").toLowerCase();

    // Always filter by userId for everyone (users and admins alike)
    filter = { userId: req.user._id };

    const notifications = await Notification.find(filter)
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

router.put("/:id/read", authMiddleware, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notif)
      return res.status(404).json({ message: "Notification not found" });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ message: "Error marking notification as read" });
  }
});

// Delete notification
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const role = (req.userRole || req.user.role || "").toLowerCase();

    const filter = {
      _id: req.params.id,
    };
    if (role !== "admin" && role !== "super admin") {
      // Convert both to string for safe comparison
      filter.userId = req.user._id.toString();
    }
    const notif = await Notification.findOneAndDelete(filter);

    if (!notif) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting notification" });
  }
});

// Delete all notifications for user (optional)
router.delete("/", authMiddleware, async (req, res) => {
  try {
    const role = (req.userRole || req.user.role || "").toLowerCase();

    const filter =
      role === "admin" || role === "super admin"
        ? {} // delete all notifications
        : { userId: req.user._id.toString() }; // delete only own

    await Notification.deleteMany(filter);
    res.json({ message: "All notifications deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting notifications" });
  }
});

// PUT /api/notifications/read-all
router.put("/read-all", authMiddleware, async (req, res) => {
  try {
    const role = (req.userRole || req.user.role || "").toLowerCase();

    const filter =
      role === "admin" || role === "super admin"
        ? {} // Mark all as read for all users (admins only)
        : { userId: req.user._id }; // Mark all as read for current user

    const result = await Notification.updateMany(filter, { read: true });

    res.json({
      message: "All notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Error marking all as read:", err.message);
    res
      .status(500)
      .json({ message: "Error marking all notifications as read" });
  }
});

module.exports = router;
