const { GoogleAuth, OAuth2Client } = require('google-auth-library');
const PRODUCT = 'wikiracr_pro';
const PACKAGE = 'com.wikiracr.app';
let auth;
function configured() { return process.env.PLAY_BILLING_ENABLED === 'true' && !!process.env.PLAY_SERVICE_ACCOUNT && /^[a-f0-9]{64}$/i.test(process.env.PLAY_TOKEN_KEY || ''); }
async function call(method, path, body) {
  if (!configured()) throw new Error('Google Play billing is not configured');
  auth ||= new GoogleAuth({ credentials: JSON.parse(process.env.PLAY_SERVICE_ACCOUNT), scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const client = await auth.getClient();
  const response = await client.request({ method, url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/${path}`, data: body, timeout: 10000 });
  return response.data;
}
const q = encodeURIComponent;
const api = {
  configured, PRODUCT, PACKAGE,
  get: token => call('GET', `purchases/subscriptionsv2/tokens/${q(token)}`),
  acknowledge: token => call('POST', `purchases/subscriptions/${PRODUCT}/tokens/${q(token)}:acknowledge`, {}),
  cancel: token => call('POST', `purchases/subscriptionsv2/tokens/${q(token)}:cancel`, { cancellationContext: { cancellationType: 'DEVELOPER_REQUESTED_STOP_PAYMENTS' } }),
  verifyPush: async header => {
    if (!header?.startsWith('Bearer ') || !process.env.PLAY_RTDN_AUDIENCE || !process.env.PLAY_RTDN_EMAIL) throw new Error('Invalid Play notification authentication');
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: header.slice(7), audience: process.env.PLAY_RTDN_AUDIENCE });
    const payload = ticket.getPayload();
    if (payload?.email_verified !== true || payload.email !== process.env.PLAY_RTDN_EMAIL) throw new Error('Invalid Play notification identity');
  },
};
module.exports = api;
