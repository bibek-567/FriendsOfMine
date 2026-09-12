import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sendDiscordMessage } = require('./discord-client.cjs');
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const env = loadEnv();
const port = Number(env.PORT || 3000);

function loadEnv() {
  const values = {};
  try {
    const contents = requireTextFile(join(rootDir, '.env'));
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
      if (match && !match[1].startsWith('#')) {
        values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    }
  } catch {
    // .env is optional until the webhook is configured.
  }
  return values;
}

function requireTextFile(path) {
  return readFileSync(path, 'utf8');
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 20_000) throw new Error('Message payload is too large.');
  }
  return JSON.parse(body || '{}');
}

async function sendToDiscord(message) {
  try {
    await sendDiscordMessage(message, env.DISCORD_ORDER_WEBHOOK || env.DISCORD_WEBHOOK_URL);
  } catch (error) {
    error.status = error.status === 429 ? 429 : error.status || 502;
    throw error;
  }
}

async function updateDeliveryStatus(orderId, deliveryStatus) {
  const apiUrl = String(env.APP_API_URL || '').replace(/\/$/, '');
  if (!apiUrl || !env.DELIVERY_COMMAND_SECRET) {
    throw new Error('APP_API_URL and DELIVERY_COMMAND_SECRET must be configured for delivery commands.');
  }

  const response = await fetch(`${apiUrl}/api/delivery-status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DELIVERY_COMMAND_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderId, deliveryStatus })
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Delivery status update failed.');
  return result;
}

function startDiscordCommandBot() {
  if (!env.DISCORD_BOT_TOKEN) {
    console.log('Discord slash commands disabled: DISCORD_BOT_TOKEN is not configured.');
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const commands = [
    new SlashCommandBuilder()
      .setName('start')
      .setDescription('Start live delivery tracking for an order')
      .addStringOption((option) => option.setName('order').setDescription('Order ID, for example FOM-31531').setRequired(true)),
    new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Mark an order as delivered')
      .addStringOption((option) => option.setName('order').setDescription('Order ID, for example FOM-31531').setRequired(true))
  ].map((command) => command.toJSON());

  client.once('clientReady', async () => {
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);
    const route = env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(client.user.id, env.DISCORD_GUILD_ID)
      : Routes.applicationCommands(client.user.id);
    try {
      await rest.put(route, { body: commands });
      console.log(`Discord slash commands ready as ${client.user.tag}.`);
    } catch (error) {
      console.error('Discord command registration failed. Check DISCORD_GUILD_ID and invite the bot to that server with applications.commands permission:', error.message);
    }
  });

  client.on('error', (error) => {
    console.error('Discord client error:', error.message);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || !['start', 'stop'].includes(interaction.commandName)) return;
    if (env.DISCORD_TRACK_CHANNEL_ID && interaction.channelId !== env.DISCORD_TRACK_CHANNEL_ID) {
      await interaction.reply({ content: 'Use these commands in the delivery tracking channel.', ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to control deliveries.', ephemeral: true });
      return;
    }

    const orderId = interaction.options.getString('order', true).replace(/^#/, '').trim().toUpperCase();
    const deliveryStatus = interaction.commandName === 'start' ? 'tracking' : 'delivered';
    try {
      await updateDeliveryStatus(orderId, deliveryStatus);
      await interaction.reply(`Order #${orderId} is now ${deliveryStatus === 'tracking' ? 'live for tracking' : 'marked as delivered'}.`);
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  });

  client.login(env.DISCORD_BOT_TOKEN).catch((error) => {
    console.error('Discord command bot login failed:', error.message);
  });
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/api/status') {
      sendJson(response, 200, { configured: Boolean(env.DISCORD_WEBHOOK_URL) });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/messages') {
      const body = await readBody(request);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        sendJson(response, 400, { error: 'Write a message before sending.' });
        return;
      }
      if (message.length > 2_000) {
        sendJson(response, 400, { error: 'Discord messages can be up to 2,000 characters.' });
        return;
      }

      await sendToDiscord(message);
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, request.method === 'GET' ? 404 : 405, {
      error: request.method === 'GET' ? 'Not found.' : 'Method not allowed.',
    });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.message || 'Something went wrong.' });
  }
});

server.listen(port, () => {
  console.log(`Discord messenger running at http://localhost:${port}`);
  startDiscordCommandBot();
});