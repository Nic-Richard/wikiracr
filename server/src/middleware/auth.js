const { verifyToken } = require('@clerk/backend');
const clerk = require('../lib/clerk');
const log = require('../lib/logger');

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    req.userId = payload.sub;
    next();
  } catch (err) {
    log.debug('[auth] token verification failed:', err.message);
    res.status(401).json({ error: `Token invalid: ${err.message}` });
  }
}

async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      req.userId = payload.sub;
    } catch {}
  }
  next();
}

async function requirePro(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorised' });
  try {
    const user = await clerk.users.getUser(req.userId);
    if (!user.publicMetadata?.isPro) {
      return res.status(403).json({ error: 'Pro subscription required' });
    }
    next();
  } catch (err) {
    log.warn('[auth] requirePro failed:', err.message);
    res.status(500).json({ error: 'Auth error' });
  }
}

module.exports = { requireAuth, optionalAuth, requirePro };
