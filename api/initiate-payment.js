const axios = require('axios');
const {
  createOrder,
  getBaseUrl,
  parseBody,
  requireEnv,
  postKitchenWebhook,
  saveOrder,
  signHmacBase64
} = require('./payment-utils');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function buildEsewaForm(order) {
  const productCode = requireEnv('ESEWA_PRODUCT_CODE');
  const secret = requireEnv('ESEWA_SECRET');
  const fields = {
    amount: String(order.totalAmount),
    tax_amount: '0',
    total_amount: String(order.totalAmount),
    transaction_uuid: order.orderId,
    product_code: productCode,
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: `${getBaseUrl()}/api/esewa-callback`,
    failure_url: `${getBaseUrl()}/checkout?status=failed&orderId=${encodeURIComponent(order.orderId)}`,
    signed_field_names: 'total_amount,transaction_uuid,product_code'
  };

  fields.signature = signHmacBase64(
    `total_amount=${fields.total_amount},transaction_uuid=${fields.transaction_uuid},product_code=${fields.product_code}`,
    secret
  );

  return {
    action: process.env.ESEWA_PAYMENT_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
    fields
  };
}

async function initiateKhalti(order) {
  const secret = requireEnv('KHALTI_SECRET_KEY');
  const response = await axios.post(
    process.env.KHALTI_INITIATE_URL || 'https://a.khalti.com/api/v2/epayment/initiate/',
    {
      return_url: `${getBaseUrl()}/api/khalti-callback`,
      website_url: getBaseUrl(),
      amount: Math.round(order.totalAmount * 100),
      purchase_order_id: order.orderId,
      purchase_order_name: 'Friends Of Mine Order',
      customer_info: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone
      }
    },
    { headers: { Authorization: `Key ${secret}`, 'Content-Type': 'application/json' } }
  );

  if (!response.data || !response.data.payment_url) {
    throw new Error('Khalti did not return a payment URL.');
  }

  return response.data.payment_url;
}

function buildFonepayRedirect(order) {
  const paymentUrl = requireEnv('FONEPAY_PAYMENT_URL');
  const merchantId = requireEnv('FONEPAY_MERCHANT_ID');
  const secret = requireEnv('FONEPAY_SECRET_KEY');
  const currency = process.env.FONEPAY_CURRENCY || 'NPR';
  const returnUrl = `${getBaseUrl()}/api/fonepay-callback`;
  const signatureTemplate = (process.env.FONEPAY_SIGNATURE_TEMPLATE || '{{merchantId}}|{{orderId}}|{{amount}}|{{currency}}|{{returnUrl}}')
    .replaceAll('{{merchantId}}', merchantId)
    .replaceAll('{{orderId}}', order.orderId)
    .replaceAll('{{amount}}', String(order.totalAmount))
    .replaceAll('{{currency}}', currency)
    .replaceAll('{{returnUrl}}', returnUrl);
  const signature = signHmacBase64(signatureTemplate, secret, process.env.FONEPAY_SIGNATURE_ALGORITHM || 'sha256');
  const params = new URLSearchParams({
    merchant_id: merchantId,
    transaction_id: order.orderId,
    amount: String(order.totalAmount),
    currency,
    return_url: returnUrl,
    signature
  });

  return `${paymentUrl}${paymentUrl.includes('?') ? '&' : '?'}${params.toString()}`;
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed.' });

  try {
    const payload = parseBody(req);
    const provider = String(payload.paymentMethod || '').toLowerCase();
    if (!['esewa', 'khalti', 'fonepay'].includes(provider)) {
      return res.status(400).json({ success: false, message: 'Choose a supported online payment provider.' });
    }

    const order = await createOrder(payload, provider);
    if (!order.totalAmount || !order.items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    await saveOrder(order);
    await postKitchenWebhook(order);

    if (provider === 'esewa') {
      return res.status(200).json({ success: true, provider, orderId: order.orderId, form: buildEsewaForm(order) });
    }

    if (provider === 'khalti') {
      const redirectUrl = await initiateKhalti(order);
      return res.status(200).json({ success: true, provider, orderId: order.orderId, redirectUrl });
    }

    return res.status(200).json({
      success: true,
      provider,
      orderId: order.orderId,
      redirectUrl: buildFonepayRedirect(order)
    });
  } catch (error) {
    console.error('Payment initiation failed', error);
    return res.status(500).json({ success: false, message: error.message || 'Unable to initiate payment.' });
  }
};
