const mongoose = require('mongoose');

const pushNotificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  subscriptions: [{ // Changed from a single subscription to an array of subscriptions
    endpoint: { type: String, required: true },
    expirationTime: { type: Number, required: false },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  }],
  isSent: { 
    type: Boolean, 
    default: false 
  },
  message: { 
    type: String, 
    required: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('PushNotification', pushNotificationSchema);
