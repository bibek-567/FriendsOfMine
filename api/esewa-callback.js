const {
  getBaseUrl,
  initializeFirestore,
  postKitchenWebhook,
  requireEnv,
  safeEqual,
  saveOrder,
  signHmacBase64
} = require('./payment-utils');

function decodeEsewaData(encoded) {
  const normalized = String(encoded || '').replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
}

module.exports = async (req, res) => {
  try {
    const encoded = (req.query && req.query.data) || '';
    const data = decodeEsewaData(encoded);
    const signatureInput = (data.signed_field_names || 'total_amount,transaction_uuid,product_code')
      .split(',')
      .map((field) => `${field}=${data[field] || ''}`)
      .join(',');
    const expected = signHmacBase64(signatureInput, requireEnv('ESEWA_SECRET'));
    const verified = safeEqual(expected, data.signature);
    const paid = verified && String(data.status || '').toUpperCase() === 'COMPLETE';
    const orderId = data.transaction_uuid || '';
    const firestore = initializeFirestore();
    const snapshot = await firestore.collection('orders').doc(orderId).get();
    const storedOrder = snapshot.exists ? snapshot.data() : { orderId, paymentMethod: 'esewa' };
    const order = {
      ...storedOrder,
      orderId,
      paymentMethod: 'esewa',
      status: paid ? 'paid' : 'failed',
      transactionId: data.transaction_code || orderId,
      paidAt: paid ? new Date().toISOString() : undefined
    };

    await saveOrder(order);
    if (paid && storedOrder.status !== 'paid') await postKitchenWebhook(order);
    return res.redirect(`${getBaseUrl()}/order-success?status=${paid ? 'success' : 'failed'}&orderId=${encodeURIComponent(orderId)}`);
  } catch (error) {
    console.error('eSewa callback failed', error);
    return res.redirect(`${getBaseUrl()}/checkout?status=failed`);
  }
};
