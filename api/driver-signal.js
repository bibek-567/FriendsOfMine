const { initializeFirestore } = require('./payment-utils');
const { sendDiscordMessage } = require('../Discord Bot Msg/discord-client.cjs');

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
    const orderId = String(payload.orderId || '').trim();
    const latitude = Number(payload.lat);
    const longitude = Number(payload.lng);
    if (!orderId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ success: false, message: 'Order ID, latitude, and longitude are required.' });
    }

    const firestore = initializeFirestore();
    const orderRef = firestore.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    await orderRef.set({
      driverName: payload.driverName || 'Driver',
      driverLat: latitude,
      driverLng: longitude,
      driverLocationUpdatedAt: new Date().toISOString(),
      deliveryStatus: 'tracking'
    }, { merge: true });

    const webhookUrl = process.env.DISCORD_TRACK_WEBHOOK || process.env.DISCORD_DRIVER_WEBHOOK || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl === 'Your-Info-Here') {
      return res.status(503).json({ success: false, message: 'Discord webhook is not configured.' });
    }

    await sendDiscordMessage([
      `Driver signal received for order ${orderId}`,
      `Location: ${payload.location || 'Dhangadi'}`,
      `Driver: ${payload.driverName || 'Driver'}`,
      `Status: ${payload.status || 'tracking'}`,
      `Latitude: ${latitude}`,
      `Longitude: ${longitude}`
    ].join('\n'), webhookUrl);

    return res.status(200).json({
      success: true,
      message: 'Driver tracking signal processed.',
      payload
    });
  } catch (error) {
    console.error('Driver signal request failed', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process driver tracking signal.',
      error: error.message
    });
  }
};
