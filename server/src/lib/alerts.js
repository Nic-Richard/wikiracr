const { createHmac } = require('node:crypto');
const APP = 'wikiracr';

// Posts to the Discord alerts relay. Never throws and never delays the caller.
function sendAlert(type, alert) {
  const { ALERTS_URL, ALERTS_SECRET } = process.env;
  if (!ALERTS_URL || !ALERTS_SECRET) return;
  const body = JSON.stringify({ app: APP, type, ...alert });
  const headers = { Authorization: `Bearer ${ALERTS_SECRET}`, 'Content-Type': 'application/json' };
  if (process.env.ALERTS_ACTION_SECRET) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      headers['X-Alert-Timestamp'] = timestamp;
      headers['X-Alert-Signature'] = createHmac('sha256', process.env.ALERTS_ACTION_SECRET).update(`${timestamp}.${body}`).digest('hex');
  }
  fetch(ALERTS_URL, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(5000),
  }).catch((err) => console.warn('alert not sent:', err.message));
}

function errorAlert(args) {
  const title = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ').slice(0, 200);
  const err = args.find((a) => a instanceof Error);
  sendAlert('errors', {
    title,
    key: typeof args[0] === 'string' ? args[0] : title,
    description: err?.stack ? '```\n' + err.stack.slice(0, 3000) + '\n```' : '',
  });
}

async function eraseAccountAlerts(references, cursor = {}) {
  const { ALERTS_URL, ALERTS_SECRET } = process.env;
  if (!ALERTS_URL && !ALERTS_SECRET) return { complete: true, cursor: {} };
  if (!ALERTS_URL || !ALERTS_SECRET) throw new Error('Alert erasure configuration is incomplete');
  const url = new URL(ALERTS_URL);
  if (!url.pathname.endsWith('/alert')) throw new Error('Alert erasure requires an /alert URL');
  url.pathname = url.pathname.slice(0, -6) + '/erase';
  url.search = '';
  const response = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${ALERTS_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: APP, references, cursor }), signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Alert erasure failed (${response.status})`);
  const result = await response.json();
  if (typeof result.complete !== 'boolean' || !result.cursor || typeof result.cursor !== 'object' || Array.isArray(result.cursor) ||
      Object.entries(result.cursor).some(([id, value]) => !/^\d{1,20}$/.test(id) || typeof value !== 'string' || (value !== 'done' && !/^\d{1,20}$/.test(value)))) {
    throw new Error('Alert relay returned invalid erasure progress');
  }
  return result;
}

module.exports = { sendAlert, errorAlert, eraseAccountAlerts };
