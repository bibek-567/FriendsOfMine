const { URL } = require('node:url');

function getWebhookUrl() {
  return String(
    process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_KITCHEN_WEBHOOK || ''
  ).trim();
}

function validateWebhookUrl(webhookUrl) {
  if (!webhookUrl || webhookUrl === 'Your-Info-Here') {
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

async function sendDiscordMessage(message, webhookUrl = getWebhookUrl()) {
  const parsedUrl = validateWebhookUrl(webhookUrl);
  const response = await fetch(parsedUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: message,
      allowed_mentions: { parse: [] }
    })
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
  const location = order.lat && order.lng
    ? `${order.lat}, ${order.lng}`
    : order.deliveryLocation || 'Dhangadi, Nepal';

  return [
    `New food order #${order.orderId || 'unknown'}`,
    `Status: ${order.status || 'pending'}`,
    `Payment: ${payment}`,
    `Name: ${order.customerName || 'Guest Customer'}`,
    `Phone: ${order.customerPhone || 'N/A'}`,
    `Email: ${order.customerEmail || 'N/A'}`,
    `Address: ${order.deliveryLocation || 'Dhangadi, Nepal'}`,
    `Location: ${location}`,
    `Total: NPR ${order.totalAmount || 0}`,
    `Items:\n${items}`
  ].join('\n');
}

async function sendOrderToDiscord(order) {
  await sendDiscordMessage(formatOrderMessage(order));
  return true;
}

module.exports = {
  formatOrderMessage,
  getWebhookUrl,
  sendDiscordMessage,
  sendOrderToDiscord,
  validateWebhookUrl
};
