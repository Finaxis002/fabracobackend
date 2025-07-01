const express = require("express");
const router = express.Router();
const ChatMessage = require("../models/chatMessage");
const Case = require("../models/Case");
const { authMiddleware } = require("../middleware/auth");



// GET /api/chats/recent
router.get("/recent", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const userRole = req.userRole || "";

    let accessibleCaseIds = [];

    if (userRole === "admin") {
      const allCases = await Case.find({}, { _id: 1 });
      accessibleCaseIds = allCases.map((c) => c._id.toString());
    } else {
      const assignedCases = await Case.find(
        { "assignedUsers.userId": userId },
        { _id: 1 }
      );
      accessibleCaseIds = assignedCases.map((c) => c._id.toString());
    }

    if (accessibleCaseIds.length === 0) return res.json([]);

    const recentChats = await ChatMessage.find({
      caseId: { $in: accessibleCaseIds },
    })
      .sort({ createdAt: -1 }) // newest first
      .limit(10);

    res.json(recentChats);
  } catch (error) {
    console.error("Error fetching recent chats:", error);
    res.status(500).json({ message: "Failed to fetch recent chats" });
  }
});


router.get("/unread-counts", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id.toString();    // user document _id as string
    const userRole = req.userRole || '';       // role from middleware

    let accessibleCaseIds = [];

    if (userRole === "admin") {
      const allCases = await Case.find({}, { _id: 1 });
      accessibleCaseIds = allCases.map((c) => c._id.toString());
    } else {
      const assignedCases = await Case.find(
        { "assignedUsers.userId": userId },
        { _id: 1 }
      );
      accessibleCaseIds = assignedCases.map((c) => c._id.toString());
    }

    if (accessibleCaseIds.length === 0) return res.json({});

    const unreadMessages = await ChatMessage.find({
      caseId: { $in: accessibleCaseIds },
      readBy: { $ne: userId },
    });

    const unreadCounts = {};

    for (const msg of unreadMessages) {
      if (!unreadCounts[msg.caseId]) unreadCounts[msg.caseId] = 0;
      unreadCounts[msg.caseId]++;
    }

    res.json(unreadCounts);
  } catch (error) {
    console.error("Error fetching unread chat counts:", error);
    res.status(500).json({ message: "Failed to fetch unread chat counts." });
  }
});


// PUT /api/chats/mark-read/:caseId
router.put("/mark-read/:caseId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body; // Destructure userId from the body object
    const { caseId } = req.params;

    // Find all chat messages for this case where readBy does NOT include this userId
    const unreadMessages = await ChatMessage.find({
      caseId,
      readBy: { $ne: userId },
    });

    // Update each message's readBy to include this userId
    const updatePromises = unreadMessages.map((msg) => {
      msg.readBy.push(userId);
      return msg.save();
    });

    await Promise.all(updatePromises);

    res.status(200).json({ message: "Marked chats as read" });
  } catch (error) {
    console.error("Error marking chats as read:", error);
    res.status(500).json({ message: "Failed to mark chats as read" });
  }
});

module.exports = router;
