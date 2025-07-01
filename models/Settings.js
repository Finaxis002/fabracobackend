const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
});

const Settings = mongoose.model("Settings", settingsSchema);

// ✅ Proper CommonJS export
module.exports = Settings;
