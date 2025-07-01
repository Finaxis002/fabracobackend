const express = require("express");
const Settings = require("../models/Settings")

const router = express.Router();

// ✅ GET /api/settings/app-name
router.get("/app-name", async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: "appName" });
    res.json({ appName: setting?.value || "FranchiseFlow" });
  } catch (error) {
    console.error("Error fetching app name:", error);
    res.status(500).json({ error: "Failed to fetch app name" });
  }
});

// ✅ POST /api/settings/app-name
router.post("/app-name", async (req, res) => {
  try {
    const { appName } = req.body;

    if (!appName || typeof appName !== "string") {
      return res.status(400).json({ error: "App name is required" });
    }

    const setting = await Settings.findOneAndUpdate(
      { key: "appName" },
      { value: appName },
      { upsert: true, new: true }
    );

    res.json({ appName: setting.value });
  } catch (error) {
    console.error("Error updating app name:", error);
    res.status(500).json({ error: "Failed to update app name" });
  }
});

module.exports = router;
