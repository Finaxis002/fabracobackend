const webPush = require('web-push');

// Generate the VAPID keys
const vapidKeys = webPush.generateVAPIDKeys();

console.log('VAPID Public Key:', vapidKeys.publicKey);
console.log('VAPID Private Key:', vapidKeys.privateKey);
