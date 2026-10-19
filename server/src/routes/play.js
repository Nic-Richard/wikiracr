const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../lib/rateLimit');
const { getPlayBilling } = require('../lib/playService');
const api = require('../lib/playApi');
const limit = rateLimit({ limit: 30, windowMs: 60_000, key: req => req.userId, message: 'Too many billing requests. Try again shortly.' });

router.get('/status', requireAuth, limit, async (req, res) => {
  try { res.json(await getPlayBilling().status(req.userId)); }
  catch { res.status(503).json({ error: 'Google Play is unavailable. Please try again.' }); }
});
router.post('/verify', requireAuth, limit, async (req, res) => {
  if (!api.configured()) return res.status(503).json({ error: 'Google Play purchases are not available yet.' });
  const token = req.body?.purchaseToken;
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return res.status(400).json({ error: 'Invalid purchase.' });
  try { res.json(await getPlayBilling().verify(req.userId, token)); }
  catch { res.status(409).json({ error: 'This purchase could not be added to your account. Restore it or contact support.' }); }
});
router.post('/notify', async (req, res) => {
  try { await api.verifyPush(req.headers.authorization); }
  catch { return res.status(401).end(); }
  if (!api.configured()) return res.status(503).end();
  let data;
  try { data = JSON.parse(Buffer.from(req.body?.message?.data || '', 'base64').toString('utf8')); }
  catch { return res.status(400).end(); }
  if (data.packageName !== api.PACKAGE) return res.status(400).end();
  try { await getPlayBilling().notify(data); res.status(204).end(); }
  catch { res.status(503).end(); }
});
module.exports = router;
