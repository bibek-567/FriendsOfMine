import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sendDiscordMessage } = require('./discord-client.cjs');

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
    await sendDiscordMessage(message, env.DISCORD_WEBHOOK_URL);
  } catch (error) {
    error.status = error.status === 429 ? 429 : error.status || 502;
    throw error;
  }
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
});