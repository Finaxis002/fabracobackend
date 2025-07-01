// routes/recentRemarks.js
const express = require("express");
const router = express.Router();
const Remark = require("../models/remark");
const { authMiddleware } = require("../middleware/auth");
const Case = require("../models/Case");






// routes/recentRemarks.js

// router.get("/recent", authMiddleware, async (req, res) => {
//   try {
//     const userId = req.user.id;

//     // Fetch latest 3 remarks (regardless of read status)
//     const recentRemarks = await Remark.find({})
//       .sort({ createdAt: -1 })
//       .limit(3);

//     // Attach `read` status per remark
//     const remarksWithRead = recentRemarks.map((remark) => {
//       const isRead = remark.readBy.includes(userId);
//       return { ...remark.toObject(), read: isRead };
//     });

//     res.json(remarksWithRead);
//   } catch (err) {
//     console.error("Failed to fetch recent remarks", err.message);
//     res.status(500).json({ message: "Error fetching recent remarks" });
//   }
// });

router.get("/recent", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId; // username like "admin" or "444"
    const userRole = req.user.role;

    let remarks;

    if (userRole === "Admin") {
      // Super admin: fetch all remarks
      remarks = await Remark.find({})
        .sort({ createdAt: -1 })
        .limit(50);
    } else {
      // Normal user: fetch remarks only for assigned cases
      const assignedCases = await Case.find(
        { "assignedUsers.userId": userId },
        { _id: 1 }
      );
      const assignedCaseIds = assignedCases.map((c) => c._id);

      if (assignedCaseIds.length === 0) {
        return res.json([]);
      }

      remarks = await Remark.find({
        caseId: { $in: assignedCaseIds },
      })
        .sort({ createdAt: -1 })
        .limit(50);
    }

    const formattedRemarks = remarks.map((r) => ({
      ...r.toObject(),
      read: r.readBy?.includes(userId),
    }));

    res.json(formattedRemarks);
  } catch (error) {
    console.error("Error fetching recent remarks:", error);
    res.status(500).json({ message: "Failed to fetch recent remarks." });
  }
});


// Add this route BEFORE the authMiddleware protected routes
router.get("/public/recent", async (req, res) => {
  try {
    // Fetch latest 3 remarks (or more if needed)
    const recentRemarks = await Remark.find({})
      .sort({ createdAt: -1 })
      .limit(3);

    // Since no user info, we can't mark read/unread, so just send remarks as is
    // Optionally omit sensitive fields if needed here

    const publicRemarks = recentRemarks.map((remark) => {
      // Convert Mongoose doc to plain object
      const obj = remark.toObject();

      // Remove readBy field so clients don't see internal read data
      delete obj.readBy;

      return obj;
    });

    res.json(publicRemarks);
  } catch (err) {
    console.error("Failed to fetch public recent remarks", err.message);
    res.status(500).json({ message: "Error fetching public recent remarks" });
  }
});


// PATCH /api/remarks/:id/read
router.patch("/:id/read", authMiddleware, async (req, res) => {
  const userId = req.user.id; // ✅ Now safe

  const remark = await Remark.findById(req.params.id);
  if (!remark) return res.status(404).json({ error: "Remark not found" });

  if (!remark.readBy.includes(userId)) {
    remark.readBy.push(userId);
    await remark.save();
  }

  res.json({ success: true });
});





// GET /api/remarks → fetch all remarks with auth
router.get("/", authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;

  const remarks = await Remark.find().sort({ createdAt: -1 });

  const formatted = remarks.map((remark) => ({
    ...remark.toObject(),
    read: remark.readBy.includes(currentUserId),
  }));

  res.json(formatted);
});


// Backend route (example using Express)
router.delete('/', async (req, res) => {
  try {
    const { caseId, serviceId } = req.body;
    await Remark.deleteMany({ caseId, serviceId });
    res.status(200).send('Remarks deleted successfully');
  } catch (error) {
    res.status(500).send('Error deleting remarks');
  }
});

module.exports = router;
