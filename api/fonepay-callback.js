const {
  getBaseUrl,
  initializeFirestore,
  postKitchenWebhook,
  requireEnv,
  safeEqual,
  saveOrder,
  signHmacBase64
} = require('./payment-utils');

function getSignatureInput(params) {
  return (process.env.FONEPAY_CALLBACK_SIGNATURE_TEMPLATE || '{{merchantId}}|{{orderId}}|{{amount}}|{{currency}}|{{status}}')
    .replaceAll('{{merchantId}}', params.merchant_id || '')
    .replaceAll('{{orderId}}', params.transaction_id || '')
    .replaceAll('{{amount}}', params.amount || '')
    .replaceAll('{{currency}}', params.currency || 'NPR')
    .replaceAll('{{status}}', params.status || '');
}

module.exports = async (req, res) => {
  try {
    const params = { ...(req.query || {}), ...(req.body || {}) };
    const orderId = params.transaction_id || '';
    const expected = signHmacBase64(
      getSignatureInput(params),
      requireEnv('FONEPAY_SECRET_KEY'),
      process.env.FONEPAY_SIGNATURE_ALGORITHM || 'sha256'
    );
    const verified = safeEqual(expected, params.signature || params.DV);
    const paid = verified && ['success', 'completed', 'paid'].includes(String(params.status || '').toLowerCase());
    const firestore = initializeFirestore();
    const snapshot = await firestore.collection('orders').doc(orderId).get();
    const storedOrder = snapshot.exists ? snapshot.data() : { orderId, paymentMethod: 'fonepay' };
    const order = {
      ...storedOrder,
      orderId,
      paymentMethod: 'fonepay',
      status: paid ? 'paid' : 'failed',
      transactionId: params.reference_id || params.transaction_id || orderId,
      paidAt: paid ? new Date().toISOString() : undefined
    };

    await saveOrder(order);
    if (paid && storedOrder.status !== 'paid') await postKitchenWebhook(order);
    return res.redirect(`${getBaseUrl()}/order-success?status=${paid ? 'success' : 'failed'}&orderId=${encodeURIComponent(orderId)}`);
  } catch (error) {
    console.error('Fonepay callback failed', error);
    return res.redirect(`${getBaseUrl()}/checkout?status=failed`);
  }
};
