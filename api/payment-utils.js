const crypto = require('crypto');

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
}

function getBaseUrl() {
  return process.env.APP_BASE_URL || 'https://Your-Info-Here.example';
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value === 'Your-Info-Here') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function initializeFirestore() {
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    const appOptions = { projectId: process.env.FIREBASE_PROJECT_ID || 'Your-Info-Here' };
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_SERVICE_ACCOUNT_JSON !== 'Your-Info-Here') {
      appOptions.credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    }
    admin.initializeApp(appOptions);
  }
  return admin.firestore();
}

async function createUniqueOrderCode(payload = {}) {
  const firestore = initializeFirestore();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const orderCode = `FOM-${Math.floor(10000 + Math.random() * 90000)}`;
    try {
      await firestore.collection('orders').doc(orderCode).create({
        orderId: orderCode,
        status: 'reserving',
        deviceToken: payload.deviceToken || 'local-device',
        createdAt: new Date().toISOString()
      });
      return orderCode;
    } catch (error) {
      if (error.code !== 6) throw error;
    }
  }

  throw new Error('Unable to create a unique order code.');
}

async function createOrder(payload, paymentMethod) {
  return {
    orderId: await createUniqueOrderCode(payload),
    customerName: payload.customerName || 'Guest Customer',
    customerPhone: payload.customerPhone || '9800000000',
    customerEmail: payload.customerEmail || '',
    deliveryLocation: payload.deliveryLocation || 'Dhangadi, Nepal',
    totalAmount: Number(payload.totalAmount || payload.amount || 0),
    paymentMethod,
    status: 'pending',
    items: Array.isArray(payload.items) ? payload.items : [],
    deviceToken: payload.deviceToken || 'local-device',
    lat: payload.lat || '',
    lng: payload.lng || '',
    createdAt: new Date().toISOString()
  };
}

async function saveOrder(order, merge = true) {
  const firestore = initializeFirestore();
  await firestore.collection('orders').doc(order.orderId).set(order, { merge });
  return order;
}

function signHmacBase64(value, secret, algorithm = 'sha256') {
  return crypto.createHmac(algorithm, secret).update(value).digest('base64');
}

function signHmacHex(value, secret, algorithm = 'sha256') {
  return crypto.createHmac(algorithm, secret).update(value).digest('hex');
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function postKitchenWebhook(order) {
  const webhookUrl = String(process.env.DISCORD_KITCHEN_WEBHOOK || '').trim();
  if (!webhookUrl || webhookUrl === 'https://discord.com/api/webhooks/1547510503272615977/_59NikJZLfoLr6N-txffPMPkI5JLX4X_I4t7VL6Fk9tgiC6UlwPBHaXTDKwD8dVLplWi') {
    console.warn('Discord kitchen webhook is not configured.');
    return false;
  }

  try {
    const axios = require('axios');
    const phone = String(order.customerPhone || '').replace(/[^\d+]/g, '');
    const mapQuery = order.lat && order.lng
      ? `${order.lat},${order.lng}`
      : order.deliveryLocation || 'Dhangadi, Nepal';
    const itemLines = (order.items || [])
      .map((item) => `${item.name} x${item.qty}`)
      .join('\n') || 'No item details';

    await axios.post(webhookUrl, {
      username: 'Friends Of Mine Kitchen',
      content: [
        `Order have been placed #${order.orderId}`,
        '',
        `name:- ${order.customerName || ''}`,
        `phone:- ${order.customerPhone || ''}`,
        `email:- ${order.customerEmail || ''}`,
        `address:- ${order.deliveryLocation || ''}`,
        '',
        `location:- ${order.lat && order.lng ? `${order.lat}, ${order.lng}` : order.deliveryLocation || ''}`
      ].join('\n'),
      embeds: [{
        title: 'New food order received',
        description: `Payment: ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod}\nTotal: NPR ${order.totalAmount}\n\n${itemLines}`,
        color: 5814783,
        fields: [
          { name: 'Order Code', value: `#${order.orderId}`, inline: true },
          { name: 'Phone', value: order.customerPhone || 'N/A', inline: true },
          { name: 'Location', value: order.deliveryLocation || 'Dhangadi', inline: false }
        ]
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 5, label: 'Call Customer', url: `tel:${phone}` },
          { type: 2, style: 5, label: 'Open Location', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` }
        ]
      }]
    }, { timeout: 10000 });
    return true;
  } catch (error) {
    const status = error.response?.status ? ` (${error.response.status})` : '';
    console.error(`Discord kitchen notification failed${status}:`, error.message);
    return false;
  }
}

module.exports = {
  createOrder,
  createUniqueOrderCode,
  getBaseUrl,
  initializeFirestore,
  parseBody,
  postKitchenWebhook,
  requireEnv,
  safeEqual,
  saveOrder,
  signHmacBase64,
  signHmacHex
};
