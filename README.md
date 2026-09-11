# Friends Of Mine

Static cafe ordering frontend with Vercel serverless payment adapters for eSewa, Khalti, Fonepay, and cash on delivery.

## Payment setup

1. Copy `.env.example` to `.env` for local development.
2. Replace every `Your-Info-Here` value with the merchant value supplied by the provider.
3. Configure Firebase Admin credentials so pending and paid orders can be stored in Firestore.
4. Use sandbox credentials and URLs first, then replace them with production values after approval.
5. Set each provider's callback/return URLs to:
   - eSewa: `https://YOUR_DOMAIN/api/esewa-callback`
   - Khalti: `https://YOUR_DOMAIN/api/khalti-callback`
   - Fonepay: `https://YOUR_DOMAIN/api/fonepay-callback`

## Provider notes

- eSewa uses the signed v2 form flow and verifies the returned `data` signature.
- Khalti uses ePayment v2 initiation and server-side `pidx` lookup before marking an order paid.
- Fonepay uses a configurable redirect adapter because its merchant request fields, signature algorithm, and callback fields must match the approved Fonepay merchant contract. Set `FONEPAY_SIGNATURE_TEMPLATE` and `FONEPAY_CALLBACK_SIGNATURE_TEMPLATE` to the exact format in that contract.
- Provider secret keys are only read by serverless functions and are never sent from frontend JavaScript.

## Local development

```bash
npm install
npm start
```

Do not commit `.env` or real merchant credentials.

## Discord order messages

When a customer places a COD order, or a payment callback verifies an online order, the server sends the order code, customer details, payment method, total, delivery location, and item list to `DISCORD_KITCHEN_WEBHOOK`. Add the webhook URL to the deployment environment variable; the URL below is documented for this order-list channel only.

# FriendsOfMine

This is the webhook of discord channel:

order-list channel webhook: https://discord.com/api/webhooks/1547510503272615977/_59NikJZLfoLr6N-txffPMPkI5JLX4X_I4t7VL6Fk9tgiC6UlwPBHaXTDKwD8dVLplWi