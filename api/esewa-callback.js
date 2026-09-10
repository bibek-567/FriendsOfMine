const crypto = require('crypto');
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

function verifyEsewaSignature(rawData, secretKey) {
  if (!rawData || !rawData.signature || !rawData.total_amount || !rawData.transaction_uuid) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secretKey)
    .update([
      `total_amount=${rawData.total_amount}`,
      `transaction_uuid=${rawData.transaction_uuid}`,
      `product_code=${rawData.product_code || ''}`
    ].join(','))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(rawData.signature, 'hex')
  );
}

async function postKitchenWebhook(orderData) {
  const webhookUrl = process.env.DISCORD_KITCHEN_WEBHOOK || 'https://discord.com/api/webhooks/1547510503272615977/_59NikJZLfoLr6N-txffPMPkI5JLX4X_I4t7VL6Fk9tgiC6UlwPBHaXTDKwD8dVLplWi';

  const embed = {
    title: 'New order received',
    description: `Customer: ${orderData.customerName}\nPayment: eSewa\nTotal: NPR ${orderData.totalAmount}`,
    color: 5814783,
    fields: [
      { name: 'Order ID', value: orderData.orderId, inline: true },
      { name: 'Phone', value: orderData.customerPhone || 'N/A', inline: true },
      { name: 'Location', value: orderData.deliveryLocation || 'Mahendranagar', inline: false }
    ]
  };

  await axios.post(webhookUrl, {
    username: 'Friends Of Mine Kitchen',
    embeds: [embed]
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
    const incoming = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const params = { ...incoming, ...(req.query || {}) };
    const secret = process.env.ESewa_SECRET || 'demo-secret';

    const isValid = verifyEsewaSignature(params, secret);
    const orderData = {
      orderId: params.transaction_uuid || params.orderId || `FOM-${Date.now()}`,
      customerName: params.customer_name || 'Guest Customer',
      customerPhone: params.phone || '9800000000',
      totalAmount: Number(params.total_amount || params.amount || 0),
      deliveryLocation: params.delivery_location || 'Mahendranagar, Nepal',
      paymentMethod: 'esewa',
      status: isValid ? 'paid' : 'failed'
    };

    const firestore = initializeFirebase();
    await firestore.collection('orders').doc(orderData.orderId).set({
      ...orderData,
      createdAt: new Date().toISOString()
    }, { merge: true });

    if (isValid) {
      await postKitchenWebhook(orderData);
      return res.status(200).json({
        success: true,
        message: 'eSewa payment verified and order recorded.',
        order: orderData
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid eSewa signature.',
      order: orderData
    });
  } catch (error) {
    console.error('eSewa callback failed', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process eSewa callback.',
      error: error.message
    });
  }
};
