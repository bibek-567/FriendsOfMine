# Discord Channel Messenger

A small API server and shared Discord message core for sending messages to a Discord channel through a Discord webhook.

The reusable sender is in `discord-client.cjs`. The production order APIs use this same module, so COD, eSewa, Khalti, and Fonepay notifications share one validation and message format.

## Setup

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env`.
3. Put your Discord webhook URL in `.env`:

```env
DISCORD_ORDER_WEBHOOK=https://discord.com/api/webhooks/...
DISCORD_TRACK_WEBHOOK=https://discord.com/api/webhooks/...
PORT=3000
DISCORD_BOT_TOKEN=Your-Info-Here
DISCORD_GUILD_ID=Your-Info-Here
DISCORD_TRACK_CHANNEL_ID=Your-Info-Here
APP_API_URL=https://YOUR_DOMAIN
DELIVERY_COMMAND_SECRET=Your-Info-Here
```

4. Start the app:

```bash
npm start
```

The webhook is kept on the server. Send requests to the local API; the webhook URL is never exposed to clients.

Use `DISCORD_ORDER_WEBHOOK` for the orderlist channel and `DISCORD_TRACK_WEBHOOK` for the ordertrack channel. Slash commands require a Discord bot application in addition to the webhooks. Invite the bot with the `bot` and `applications.commands` scopes, then use `/start order:FOM-31531` and `/stop order:FOM-31531` in the configured `DISCORD_TRACK_CHANNEL_ID`. The bot needs Manage Server permission, and `APP_API_URL` plus `DELIVERY_COMMAND_SECRET` must point to the deployed API.

### Endpoints

- `GET /api/status` checks whether the webhook is configured.
- `POST /api/messages` sends a JSON body such as `{ "message": "Hello" }`.