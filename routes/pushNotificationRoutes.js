const mongoose = require("mongoose"); // Import mongoose
const express = require("express");
const {
  saveSubscription,
  sendPushNotification,
} = require("../pushNotification"); // Import push notification logic
const router = express.Router();
const webpush = require("web-push");
const PushNotification = require("../models/pushNotification");

const vapidKeys = {
  publicKey:
    "BFiAnzKqV9C437P10UIT5_daMne46XuJiVuSn4zQh2MQBjUIwMP9PMgk2TFQL9LOSiQy17eie7XRYZcJ0NE7jMs",
  privateKey: "IfKVIUtTj0DTM4XDblXTbZ4KLKKR1e-VY4L-xvXrAQA",
};

// Configure web-push with your VAPID keys
webpush.setVapidDetails(
  "mailto:priyadiw128@gmail.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Endpoint to save the push subscription
router.post("/save-subscription", async (req, res) => {
  const { userId, subscription } = req.body;

  try {
    const objectId = new mongoose.Types.ObjectId(userId);

    // Find the user's subscription document
    let existingSubscription = await PushNotification.findOne({
      userId: objectId,
    });

    if (!existingSubscription) {
      // If no subscription exists, create a new document
      existingSubscription = new PushNotification({
        userId: objectId,
        subscriptions: [subscription], // Store the new subscription in an array
      });
    } else {
      // Check for duplicate endpoints before adding
      const alreadyExists = existingSubscription.subscriptions.some(
        (sub) => sub.endpoint === subscription.endpoint
      );

      if (!alreadyExists) {
        existingSubscription.subscriptions.push(subscription);
      }
    }

    await existingSubscription.save();
    res
      .status(200)
      .json({
        message: "Subscription saved successfully",
        existingSubscription,
      });
  } catch (error) {
    console.error("Error saving subscription:", error);
    res.status(500).json({ message: "Error saving subscription", error });
  }
});

// New API route to send push notification
router.post("/send-notification", async (req, res) => {
  const { userId, message } = req.body;

  try {
    // Retrieve all subscriptions for the user
    const userSubscriptions = await PushNotification.findOne({ userId });

    if (!userSubscriptions || userSubscriptions.subscriptions.length === 0) {
      return res
        .status(404)
        .json({ message: "No subscriptions found for this user" });
    }

    const pushOptions = {
      vapidDetails: {
        subject: "mailto:priyadiw128@gmail.com",
        publicKey: vapidKeys.publicKey,
        privateKey: vapidKeys.privateKey,
      },
      TTL: 60, // Time to live
    };

    // Send notification to all subscriptions
    for (let i = 0; i < userSubscriptions.subscriptions.length; i++) {
      const subscription = userSubscriptions.subscriptions[i];
      const payload = JSON.stringify({
        title: "Franchise Compliance Automation",
        body:
          message ||
          "You have a new update from Franchise Compliance Automation.",
      });

      try {
        await webpush.sendNotification(subscription, payload, pushOptions);
      } catch (error) {
        if (error.statusCode === 410) {
          console.log(
            "Subscription expired or unsubscribed:",
            subscription.endpoint
          );

          // Remove the expired or unsubscribed subscription from the database
          userSubscriptions.subscriptions.splice(i, 1);
          i--; // Adjust index since we removed an element

          // Save the updated subscriptions
          await userSubscriptions.save();
        } else {
          console.error("Error sending notification:", error);
        }
      }
    }

    res.status(200).json({ message: "Push notification sent successfully" });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ message: "Error sending push notification", error });
  }
});

module.exports = router;
