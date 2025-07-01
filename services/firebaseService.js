const admin = require('firebase-admin');
const serviceAccount = require('../FirebaseSecretKey/fcakey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const sendNotification = async (token, title, body, data = {}) => {
  try {
    const message = {
      notification: { title, body },
      data, // optional custom data payload
      token
    };
    
    const response = await admin.messaging().send(message);
    return { success: true, response };
  } catch (error) {
    console.error('Notification error:', error);
    return { success: false, error };
  }
};

module.exports = { sendNotification };