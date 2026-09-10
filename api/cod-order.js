const axios = require('axios');

function initializeFirebase() {
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'friendsofmine'
    });
  }
  return admin.firestore();
}

async function postKitchenWebhook(orderData) {
  const webhookUrl = process.env.DISCORD_KITCHEN_WEBHOOK || 'https://discord.com/api/webhooks/1547510503272615977/_59NikJZLfoLr6N-txffPMPkI5JLX4X_I4t7VL6Fk9tgiC6UlwPBHaXTDKwD8dVLplWi';

  await axios.post(webhookUrl, {
    username: 'Friends Of Mine Kitchen',
    embeds: [{
      title: 'Cash on delivery order received',
      description: `Customer: ${orderData.customerName}\nPayment: COD\nTotal: NPR ${orderData.totalAmount}`,
      color: 5814783,
      fields: [
        { name: 'Order ID', value: orderData.orderId, inline: true },
        { name: 'Phone', value: orderData.customerPhone || 'N/A', inline: true },
        { name: 'Location', value: orderData.deliveryLocation || 'Mahendranagar', inline: false }
      ]
    }]
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const orderId = payload.orderId || `FOM-COD-${Date.now()}`;
    const orderData = {
      orderId,
      customerName: payload.customerName || 'Guest Customer',
      customerPhone: payload.customerPhone || '9800000000',
      deliveryLocation: payload.deliveryLocation || 'Mahendranagar, Nepal',
      totalAmount: Number(payload.totalAmount || payload.amount || 0),
      paymentMethod: 'cod',
      status: 'pending',
      items: payload.items || [],
      deviceToken: payload.deviceToken || 'local-device',
      createdAt: new Date().toISOString()
    };

    const firestore = initializeFirebase();
    await firestore.collection('orders').doc(orderId).set(orderData, { merge: true });
    await postKitchenWebhook(orderData);

    return res.status(200).json({
      success: true,
      message: 'Cash on delivery order placed successfully.',
      order: orderData
    });
  } catch (error) {
    console.error('COD order processing failed', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process cash on delivery order.',
      error: error.message
    });
  }
};
