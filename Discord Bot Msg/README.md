# Discord Channel Messenger

A small API server and shared Discord message core for sending messages to a Discord channel through a Discord webhook.

The reusable sender is in `discord-client.cjs`. The production order APIs use this same module, so COD, eSewa, Khalti, and Fonepay notifications share one validation and message format.

## Setup

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env`.
3. Put your Discord webhook URL in `.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
PORT=3000
```

4. Start the app:

```bash
npm start
```

The webhook is kept on the server. Send requests to the local API; the webhook URL is never exposed to clients.

### Endpoints

- `GET /api/status` checks whether the webhook is configured.
- `POST /api/messages` sends a JSON body such as `{ "message": "Hello" }`.