const mongoose = require("mongoose");

const remarkSchema = new mongoose.Schema({
  caseId: { type: String, required: true },
  serviceId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  remark: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
   readBy: { type: [String], default: [] }, // ✅ stores array of userIds who read
});

module.exports = mongoose.model("Remark", remarkSchema);
