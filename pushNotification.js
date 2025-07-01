const webPush = require('web-push');

// VAPID Public and Private Keys
const vapidPublicKey = 'BFiAnzKqV9C437P10UIT5_daMne46XuJiVuSn4zQh2MQBjUIwMP9PMgk2TFQL9LOSiQy17eie7XRYZcJ0NE7jMs'; // Replace with your generated public key
const vapidPrivateKey = 'IfKVIUtTj0DTM4XDblXTbZ4KLKKR1e-VY4L-xvXrAQA'; // Replace with your generated private key

// Set VAPID details for authentication
webPush.setVapidDetails('mailto:priyadiw128@gmail.com', vapidPublicKey, vapidPrivateKey);

// Function to send the push notification
const sendPushNotification = async (subscription, payload) => {
  if (!subscription || !subscription.endpoint) {
    console.error('Invalid subscription object:', subscription);
    return;
  }
  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload));
    console.log('Notification sent.');
  } catch (error) {
    console.error('Error sending notification', error);
  }
};

// Example usage: Replace this with a real subscription object from your frontend
// Example subscription format:
/*
const exampleSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123...",
  keys: {
    p256dh: "B...",
    auth: "..."
  }
};
*/
const exampleSubscription = null; // Set to null or remove this line in production

const examplePayload = {
  title: "New Case Update",
  body: "A new update has been made to your case.",
  icon: "/images/icon.png",
};

// Uncomment and use only if you have a real subscription object
// sendPushNotification(exampleSubscription, examplePayload);

module.exports = sendPushNotification;