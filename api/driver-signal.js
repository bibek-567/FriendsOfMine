const axios = require('axios');

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
    const webhookUrl = process.env.DISCORD_DRIVER_WEBHOOK || 'https://discord.com/api/webhooks/1547511218544312321/M_Uy6pYGyovNX5Qqgp9VoixmKBR9ggpDMhlV5SjSLNxU1nyaFhzkBQ9X5yYlu_oX0kLq';

    const message = {
      username: 'Friends Of Mine Driver',
      content: `🚚 Delivery tracking started for order ${payload.orderId || 'Unknown'}`,
      embeds: [{
        title: 'Driver signal received',
        description: `Location: ${payload.location || 'Mahendranagar'}\nDriver: ${payload.driverName || 'Driver'}\nStatus: ${payload.status || 'tracking'}`,
        color: 3447003,
        fields: [
          { name: 'Latitude', value: String(payload.lat || 0), inline: true },
          { name: 'Longitude', value: String(payload.lng || 0), inline: true },
          { name: 'Order ID', value: String(payload.orderId || 'Unknown'), inline: false }
        ]
      }]
    };

    await axios.post(webhookUrl, message);

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
