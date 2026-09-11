const axios = require('axios');
const {
  getBaseUrl,
  initializeFirestore,
  postKitchenWebhook,
  requireEnv,
  saveOrder
} = require('./payment-utils');

module.exports = async (req, res) => {
  try {
    const pidx = (req.query && req.query.pidx) || '';
    const orderId = (req.query && req.query.purchase_order_id) || (req.query && req.query.orderId) || '';
    if (!pidx || !orderId) {
      return res.redirect(`${getBaseUrl()}/checkout?status=failed`);
    }

    const lookup = await axios.post(
      process.env.KHALTI_LOOKUP_URL || 'https://a.khalti.com/api/v2/epayment/lookup/',
      { pidx },
      {
        headers: {
          Authorization: `Key ${requireEnv('KHALTI_SECRET_KEY')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const payment = lookup.data || {};
    const firestore = initializeFirestore();
    const snapshot = await firestore.collection('orders').doc(orderId).get();
    const storedOrder = snapshot.exists ? snapshot.data() : { orderId, paymentMethod: 'khalti' };
    const paid = payment.status === 'Completed';
    const order = {
      ...storedOrder,
      orderId,
      paymentMethod: 'khalti',
      status: paid ? 'paid' : 'failed',
      transactionId: payment.transaction_id || pidx,
      paidAt: paid ? new Date().toISOString() : undefined
    };

    await saveOrder(order);
    if (paid && storedOrder.status !== 'paid') await postKitchenWebhook(order);
    return res.redirect(`${getBaseUrl()}/order-success?status=${paid ? 'success' : 'failed'}&orderId=${encodeURIComponent(orderId)}`);
  } catch (error) {
    console.error('Khalti callback failed', error);
    return res.redirect(`${getBaseUrl()}/checkout?status=failed`);
  }
};
