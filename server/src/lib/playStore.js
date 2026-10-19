const crypto = require('node:crypto');

const ENTITLED = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'];

function createPlayStore(db, getKey = () => process.env.PLAY_TOKEN_KEY) {
  db.exec(`CREATE TABLE IF NOT EXISTS play_accounts (user_id TEXT PRIMARY KEY, account_hash TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS play_subscriptions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      token_cipher TEXT NOT NULL, state TEXT NOT NULL, expires_at INTEGER NOT NULL,
      order_id TEXT, updated_at INTEGER NOT NULL);`);
  const hash = token => crypto.createHash('sha256').update(token).digest('hex');
  function key() {
    const value = getKey();
    if (!/^[a-f0-9]{64}$/i.test(value || '')) throw new Error('Play token encryption is not configured');
    return Buffer.from(value, 'hex');
  }
  function accountId(userId) { return crypto.createHmac('sha256', key()).update('wikiracr:' + userId).digest('hex'); }
  function encrypt(token) {
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }
  function decrypt(value) {
    const bytes = Buffer.from(value, 'base64'), cipher = crypto.createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
  }
  const active = (userId, now = Date.now()) => !!db.prepare(`SELECT 1 FROM play_subscriptions
    WHERE user_id = ? AND state IN (${ENTITLED.map(() => '?').join(',')}) AND expires_at > ? LIMIT 1`).get(userId, ...ENTITLED, now);
  return {
    accountId,
    register: userId => { const id = accountId(userId); db.prepare('INSERT OR IGNORE INTO play_accounts VALUES (?, ?)').run(userId, id); return id; },
    ownerForAccount: id => db.prepare('SELECT user_id FROM play_accounts WHERE account_hash = ?').get(id)?.user_id,
    ownerForToken: token => db.prepare('SELECT user_id FROM play_subscriptions WHERE token_hash = ?').get(hash(token))?.user_id,
    active,
    status: userId => db.prepare('SELECT state, expires_at FROM play_subscriptions WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1').get(userId) || null,
    owned: userId => db.prepare('SELECT token_cipher, order_id, state, expires_at FROM play_subscriptions WHERE user_id = ?').all(userId).map(row => ({ token: decrypt(row.token_cipher), orderId: row.order_id, state: row.state, expiresAt: row.expires_at })),
    save: (userId, token, state, expiresAt, orderId) => {
      const owner = db.prepare('SELECT user_id FROM play_subscriptions WHERE token_hash = ?').get(hash(token))?.user_id;
      if (owner && owner !== userId) throw new Error('Purchase belongs to another account');
      db.prepare(`INSERT INTO play_subscriptions VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(token_hash) DO UPDATE SET token_cipher=excluded.token_cipher, state=excluded.state,
        expires_at=excluded.expires_at, order_id=excluded.order_id, updated_at=excluded.updated_at`)
        .run(hash(token), userId, encrypt(token), state, expiresAt, orderId || null, Date.now());
    },
    due: (now = Date.now()) => db.prepare(`SELECT DISTINCT user_id FROM play_subscriptions
      WHERE state != 'SUBSCRIPTION_STATE_EXPIRED' AND expires_at > ? AND (updated_at < ? OR expires_at < ?) LIMIT 20`)
      .all(now - 60 * 86400000, now - 6 * 3600_000, now).map(row => row.user_id),
    references: userId => [db.prepare('SELECT account_hash FROM play_accounts WHERE user_id = ?').get(userId)?.account_hash,
      ...db.prepare('SELECT order_id FROM play_subscriptions WHERE user_id = ?').all(userId).map(row => row.order_id)].filter(Boolean),
    erase: userId => { db.prepare('DELETE FROM play_subscriptions WHERE user_id = ?').run(userId); db.prepare('DELETE FROM play_accounts WHERE user_id = ?').run(userId); },
  };
}

module.exports = { createPlayStore, ENTITLED };
