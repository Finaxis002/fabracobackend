const express = require("express");
const router = require("express").Router({ mergeParams: true });
const Remark = require("../models/remark");
const Case = require("../models/Case");
const { authMiddleware } = require("../middleware/auth");

// GET /api/cases/:caseId/services/:serviceId/remarks
router.get("/:serviceId/remarks", authMiddleware, async (req, res) => {
  const { caseId, serviceId } = req.params;
  const userId = req.user.id; // ✅ Current logged-in user's ID from token

  try {
    const remarks = await Remark.find({ caseId, serviceId }).sort({
      createdAt: -1,
    });

    const formatted = remarks.map((remark) => ({
      ...remark.toObject(),
      read: remark.readBy?.includes(userId), // ✅ Add read flag based on current user
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching remarks:", error.message);
    res.status(500).json({ message: "Failed to fetch remarks." });
  }
});

// Public endpoint for remarks of a service in a case
router.get("/:serviceId", async (req, res) => {
  try {
    const { caseId, serviceId } = req.params;

    // Fetch remarks for the case & service (no auth required)
    const remarks = await Remark.find({ caseId, serviceId }).sort({
      createdAt: -1,
    });

    // No read info for public users, add read: false by default
    const publicRemarks = remarks.map((r) => ({
      ...r.toObject(),
      read: false,
    }));

    res.json(publicRemarks);
  } catch (err) {
    console.error("Failed to fetch public service remarks", err);
    res.status(500).json({ message: "Error fetching remarks" });
  }
});


router.post("/:serviceId/remarks", authMiddleware, async (req, res) => {
  const { caseId, serviceId } = req.params;
  const { userId, userName, remark } = req.body;

  if (!remark || !userId || !userName) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    // 1. Create and save the remark
    const newRemark = new Remark({
      caseId,
      serviceId,
      userId,
      userName,
      remark,
      readBy: [userId], // Mark as read by creator
    });
    await newRemark.save();

    // 2. Push the remark's _id to the correct service's remarks array in the case
    const updatedCase = await Case.findOneAndUpdate(
      { _id: caseId, "services.id": serviceId },
      {
        $push: { "services.$.remarks": newRemark._id },
        $set: { lastUpdate: new Date() },
      },
      { new: true }
    );

    if (!updatedCase) {
      return res.status(404).json({ message: "Case or service not found." });
    }

    // 3. Send response with the new remark
    res.status(201).json(newRemark);
  } catch (error) {
    console.error("Failed to save remark or update case:", error);
    res.status(500).json({ message: "Failed to save remark." });
  }
});


// DELETE /api/cases/:caseId/services/:serviceId/remarks/:remarkId
router.delete("/:serviceId/remarks/:remarkId", authMiddleware, async (req, res) => {
  const { caseId, serviceId, remarkId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const userPermissions = req.user.permissions || {};

  try {
    // 1. Find the remark to check permissions
    const remark = await Remark.findById(remarkId);

    if (!remark) {
      return res.status(404).json({ message: "Remark not found." });
    }

    // 2. Permission: Only Super Admin or users with delete permission can delete
    const isSuperAdmin = userRole === "Super Admin";
    const hasDeletePermission = userPermissions.delete;

    if (!isSuperAdmin && !hasDeletePermission) {
      return res.status(403).json({ message: "Permission denied to delete remark." });
    }

    // 3. Remove remark reference from the case service's remarks array
    const updatedCase = await Case.findOneAndUpdate(
      { _id: caseId, "services.id": serviceId },
      {
        $pull: { "services.$.remarks": remark._id },
        $set: { lastUpdate: new Date() }
      },
      { new: true }
    );

    // 4. Remove the remark itself
    await Remark.findByIdAndDelete(remark._id);

    res.json({ message: "Remark deleted successfully." });
  } catch (error) {
    console.error("Error deleting remark:", error);
    res.status(500).json({ message: "Failed to delete remark." });
  }
});



module.exports = router;
