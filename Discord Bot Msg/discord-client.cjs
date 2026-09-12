const { URL } = require('node:url');

function getWebhookUrl() {
  return String(
    process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_KITCHEN_WEBHOOK || ''
  ).trim();
}

function validateWebhookUrl(webhookUrl) {
  if (!webhookUrl || webhookUrl === 'https://discord.com/api/webhooks/1547510503272615977/_59NikJZLfoLr6N-txffPMPkI5JLX4X_I4t7VL6Fk9tgiC6UlwPBHaXTDKwD8dVLplWi') {
    throw new Error('Discord webhook is not configured.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    throw new Error('The Discord webhook URL is invalid.');
  }

  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'discord.com') {
    throw new Error('The webhook must be an HTTPS Discord URL.');
  }

  return parsedUrl;
}

async function sendDiscordMessage(message, webhookUrl = getWebhookUrl(), options = {}) {
  const parsedUrl = validateWebhookUrl(webhookUrl);
  const payload = {
    content: message,
    allowed_mentions: { parse: [] }
  };

  if (Array.isArray(options.components) && options.components.length) {
    payload.components = options.components;
  }

  const response = await fetch(parsedUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = new Error(`Discord rejected the message (${response.status}).`);
    error.status = response.status;
    throw error;
  }
}

function formatOrderMessage(order) {
  const items = (order.items || [])
    .map((item) => `${item.name || 'Item'} x${item.qty || 0}`)
    .join('\n') || 'No item details';
  const payment = order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod || 'pending';
  const status = String(order.status || 'pending').replace(/^\w/, (letter) => letter.toUpperCase());
  const location = order.lat && order.lng
    ? `${order.lat}, ${order.lng}`
    : order.deliveryLocation || 'Dhangadi, Nepal';
  const phone = String(order.customerPhone || '').trim();
  const phoneLink = phone ? `[Call Customer](tel:${phone.replace(/[^\d+]/g, '')})` : 'N/A';

  return [
    '**__Order have been arrived__**',
    `\`#${order.orderId || 'unknown'}\``,
    '',
    `**Status:-** ${status}`,
    `**Payment:-** ${payment}`,
    '',
    `**Name:-** ${order.customerName || 'Guest Customer'}`,
    `**Email:** ${order.customerEmail || 'N/A'}`,
    `**Address:-** ${order.deliveryLocation || 'Dhangadi, Nepal'}`,
    '',
    '`Items:`',
    items,
    '',
    `**Total:** \`NPR ${order.totalAmount || 0}\``,
    '',
    '**CONTACT:-**',
    `**Location:-** \`${location}\``,
    `**Phone:-** ${phoneLink}`
  ].join('\n');
}

function getLocationUrl(order) {
  const query = order.lat && order.lng
    ? `${order.lat},${order.lng}`
    : order.deliveryLocation || '';

  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : '';
}

async function sendOrderToDiscord(order) {
  const locationUrl = getLocationUrl(order);
  const components = locationUrl
    ? [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: 'Open Location',
          url: locationUrl
        }]
      }]
    : [];

  await sendDiscordMessage(formatOrderMessage(order), getWebhookUrl(), { components });
  return true;
}

module.exports = {
  formatOrderMessage,
  getLocationUrl,
  getWebhookUrl,
  sendDiscordMessage,
  sendOrderToDiscord,
  validateWebhookUrl
};
