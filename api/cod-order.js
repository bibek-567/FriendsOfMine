const {
  initializeFirestore,
  parseBody,
  postKitchenWebhook
} = require('./payment-utils');
const crypto = require('crypto');

function getCodOrderCode() {
  return `FOM-${crypto.randomInt(10000, 100000)}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed.' });

  try {
    const payload = parseBody(req);
    const orderId = getCodOrderCode();
    const orderData = {
      orderId,
      customerName: payload.customerName || 'Guest Customer',
      customerPhone: payload.customerPhone || '9800000000',
      customerEmail: payload.customerEmail || '',
      deliveryLocation: payload.deliveryLocation || 'Dhangadi, Nepal',
      totalAmount: Number(payload.totalAmount || payload.amount || 0),
      paymentMethod: 'cod',
      status: 'pending',
      deliveryStatus: 'preparing',
      items: Array.isArray(payload.items) ? payload.items : [],
      deviceToken: payload.deviceToken || 'local-device',
      lat: payload.lat || '',
      lng: payload.lng || '',
      createdAt: new Date().toISOString()
    };

    if (!orderData.totalAmount || !orderData.items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    const firestore = initializeFirestore();
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
      message: error.message && error.message.startsWith('Firebase is not configured')
        ? error.message
        : 'Unable to process cash on delivery order.',
      error: error.message
    });
  }
};
