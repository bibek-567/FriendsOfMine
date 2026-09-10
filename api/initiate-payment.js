const crypto = require('crypto');

function signEsewa(payload, secret) {
  const fields = ['total_amount', 'transaction_uuid', 'product_code'];
  const prepared = fields
    .filter((field) => payload[field] !== undefined && payload[field] !== null && payload[field] !== '')
    .map((field) => `${field}=${payload[field]}`)
    .join(',');

  return crypto.createHmac('sha256', secret).update(prepared).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const order = {
      amount: Number(body.amount || 0),
      merchantCode: body.merchantCode || 'EPAYTEST',
      productCode: body.productCode || 'EPAYTEST',
      orderId: body.orderId || `FOM-${Date.now()}`,
      customerName: body.customerName || 'Guest Customer',
      customerPhone: body.customerPhone || '9800000000',
      deliveryLocation: body.deliveryLocation || 'Mahendranagar, Nepal',
      paymentMethod: body.paymentMethod || 'esewa'
    };

    const esewaPayload = {
      amount: String(order.amount),
      tax_amount: '0',
      total_amount: String(order.amount),
      transaction_uuid: order.orderId,
      product_code: order.productCode,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url: `${process.env.APP_BASE_URL || 'https://friendsofmine.com'}/order-success?status=success&orderId=${order.orderId}`,
      failure_url: `${process.env.APP_BASE_URL || 'https://friendsofmine.com'}/checkout?status=failed&orderId=${order.orderId}`,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature: signEsewa(
        {
          total_amount: String(order.amount),
          transaction_uuid: order.orderId,
          product_code: order.productCode
        },
        process.env.ESewa_SECRET || 'demo-secret'
      )
    };

    const khaltiPayload = {
      return_url: `${process.env.APP_BASE_URL || 'https://friendsofmine.com'}/order-success?status=success&orderId=${order.orderId}`,
      website_url: process.env.APP_BASE_URL || 'https://friendsofmine.com',
      amount: Number(order.amount) * 100,
      purchase_order_id: order.orderId,
      purchase_order_name: 'Friends Of Mine Order',
      customer_info: {
        name: order.customerName,
        phone: order.customerPhone
      },
      merchant: {
        name: 'Friends Of Mine Cafe'
      }
    };

    return res.status(200).json({
      success: true,
      message: 'Payment payload prepared successfully.',
      order,
      providers: {
        esewa: esewaPayload,
        khalti: khaltiPayload
      }
    });
  } catch (error) {
    console.error('Payment preparation failed', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to prepare payment payload.',
      error: error.message
    });
  }
};
