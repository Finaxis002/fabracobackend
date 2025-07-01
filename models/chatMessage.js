// models/chatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  caseId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: String, default: [] }], // 👈 NEW FIELD
});


module.exports = mongoose.model('ChatMessage', chatMessageSchema);