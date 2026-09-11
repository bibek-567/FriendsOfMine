const { sendDiscordMessage } = require('../Discord Bot Msg/discord-client.cjs');

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
    const webhookUrl = process.env.DISCORD_DRIVER_WEBHOOK || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl === 'Your-Info-Here') {
      return res.status(503).json({ success: false, message: 'Discord webhook is not configured.' });
    }

    await sendDiscordMessage([
      `Driver signal received for order ${payload.orderId || 'Unknown'}`,
      `Location: ${payload.location || 'Dhangadi'}`,
      `Driver: ${payload.driverName || 'Driver'}`,
      `Status: ${payload.status || 'tracking'}`,
      `Latitude: ${payload.lat || 0}`,
      `Longitude: ${payload.lng || 0}`
    ].join('\n'), webhookUrl);

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
