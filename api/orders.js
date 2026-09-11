const { initializeFirestore } = require('./payment-utils');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const deviceToken = String((req.query && req.query.deviceToken) || 'guest');
    const firestore = initializeFirestore();
    const snapshot = await firestore.collection('orders')
      .where('deviceToken', '==', deviceToken)
      .get();

    const orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));

    return res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Fetch orders failed', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch your orders.',
      error: error.message
    });
  }
};
