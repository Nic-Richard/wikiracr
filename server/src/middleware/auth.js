const { verifyToken } = require('@clerk/backend');
const clerk = require('../lib/clerk');
const log = require('../lib/logger');
const { getDeletionStore } = require('../db');
const active = new Map();

function accountAccess(req, res) {
  const id = req.userId;
  if (getDeletionStore()?.get(id) && req.path !== '/account-deletion') {
    res.status(410).json({ error: 'Account deletion has been requested.', account_deleting: true });
    return false;
  }
  active.set(id, (active.get(id) || 0) + 1);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    const count = active.get(id) - 1;
    if (count) active.set(id, count); else active.delete(id);
  };
  res.once('finish', finish);
  res.once('close', finish);
  return true;
}

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
    if (!accountAccess(req, res)) return;
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
  if (req.userId && !accountAccess(req, res)) return;
  next();
}

async function requirePro(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorised' });
  try {
    const user = await clerk.users.getUser(req.userId);
    if (!require('../lib/playService').proAccess(user)) {
      return res.status(403).json({ error: 'Pro subscription required' });
    }
    next();
  } catch (err) {
    log.warn('[auth] requirePro failed:', err.message);
    res.status(500).json({ error: 'Auth error' });
  }
}

module.exports = { requireAuth, optionalAuth, requirePro, accountAccess, accountRequestsPending: id => !!active.get(id) };
