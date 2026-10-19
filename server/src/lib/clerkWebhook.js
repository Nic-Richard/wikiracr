const { verifyWebhook } = require('@clerk/backend/webhooks');

async function deletedUserEvent(raw, headers, signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
  if (!signingSecret) throw new Error('Clerk webhook is not configured');
  const event = await verifyWebhook(new Request('https://wikiracr.com/api/clerk/webhook', {
    method: 'POST', headers, body: raw,
  }), { signingSecret });
  if (event.type !== 'user.deleted') return null;
  if (!/^user_[a-zA-Z0-9]+$/.test(event.data.id || '')) throw new Error('Invalid deleted identity');
  return event.data.id;
}

module.exports = { deletedUserEvent };
