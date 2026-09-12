const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
    const serviceAccount = loadServiceAccount();
    const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;

    const appOptions = {
      projectId,
      credential: admin.credential.cert(serviceAccount)
    };
    admin.initializeApp(appOptions);
  }
  return admin.firestore();
}

function loadServiceAccount() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson && serviceAccountJson !== 'Your-Info-Here') {
    try {
      return JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('Firebase is not configured: FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.');
    }
  }

  const localCredentialPath = path.join(__dirname, '..', 'fom-firebase.json');
  try {
    return JSON.parse(fs.readFileSync(localCredentialPath, 'utf8'));
  } catch {
    throw new Error('Firebase is not configured: set FIREBASE_SERVICE_ACCOUNT_JSON in the server environment.');
  }
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
    deliveryStatus: 'preparing',
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
