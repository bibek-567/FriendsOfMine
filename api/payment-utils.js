const crypto = require('crypto');
const { sendOrderToDiscord } = require('../Discord Bot Msg/discord-client.cjs');

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
  try {
    await sendOrderToDiscord(order);
    return true;
  } catch (error) {
    const status = error.status ? ` (${error.status})` : '';
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
