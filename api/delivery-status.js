const { initializeFirestore } = require('./payment-utils');

const VALID_STATUSES = new Set(['tracking', 'delivered']);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed.' });

  const expectedSecret = process.env.DELIVERY_COMMAND_SECRET;
  const authorization = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expectedSecret || expectedSecret === 'Your-Info-Here' || authorization !== expectedSecret) {
    return res.status(401).json({ success: false, message: 'Unauthorized delivery command.' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const orderId = String(payload.orderId || '').trim();
    const deliveryStatus = String(payload.deliveryStatus || '').toLowerCase();
    if (!orderId || !VALID_STATUSES.has(deliveryStatus)) {
      return res.status(400).json({ success: false, message: 'Order ID and a valid delivery status are required.' });
    }

    const orderRef = initializeFirestore().collection('orders').doc(orderId);
    const snapshot = await orderRef.get();
    if (!snapshot.exists) return res.status(404).json({ success: false, message: 'Order not found.' });

    const update = {
      deliveryStatus,
      deliveryStatusUpdatedAt: new Date().toISOString()
    };
    if (deliveryStatus === 'delivered') {
      update.driverLat = null;
      update.driverLng = null;
    }

    await orderRef.set(update, { merge: true });
    return res.status(200).json({ success: true, orderId, deliveryStatus });
  } catch (error) {
    console.error('Delivery status update failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update delivery status.', error: error.message });
  }
};