function articleKey(title) {
  let value = String(title || '');
  try { value = decodeURIComponent(value); } catch {}
  return value.normalize('NFC').replaceAll('_', ' ').trim().replace(/\s+/g, ' ').toLowerCase();
}

function createArticlePolicy(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS blocked_articles (
    title_key TEXT PRIMARY KEY, title TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL
  ); CREATE TABLE IF NOT EXISTS report_reviews (
    report_id INTEGER PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
    action TEXT NOT NULL, note TEXT NOT NULL, reviewed_at INTEGER NOT NULL
  );`);
  return {
    blocked: title => !!db.prepare('SELECT 1 FROM blocked_articles WHERE title_key = ?').get(articleKey(title)),
    size: () => db.prepare('SELECT count(*) AS n FROM blocked_articles').get().n,
    list: () => db.prepare('SELECT * FROM blocked_articles ORDER BY created_at DESC').all(),
    block(title, reason) {
      if (typeof title !== 'string' || !title.trim() || title.length > 300 || typeof reason !== 'string' || !reason.trim() || reason.length > 1000) throw new Error('A valid title and reason are required');
      const row = { title_key: articleKey(title), title: title.trim(), reason: reason.trim(), created_at: Date.now() };
      db.prepare('INSERT OR REPLACE INTO blocked_articles VALUES (?, ?, ?, ?)').run(row.title_key, row.title, row.reason, row.created_at);
    },
    unblock(title) {
      db.prepare('DELETE FROM blocked_articles WHERE title_key = ?').run(articleKey(title));
    },
    pending: () => db.prepare('SELECT r.* FROM reports r LEFT JOIN report_reviews v ON v.report_id = r.id WHERE v.report_id IS NULL ORDER BY r.created_at LIMIT 100').all(),
    review(id, action, note) {
      if (!Number.isInteger(id) || !['blocked', 'dismissed', 'actioned'].includes(action) || typeof note !== 'string' || !note.trim()) throw new Error('Report ID, action and review note are required');
      if (!db.prepare('SELECT id FROM reports WHERE id = ?').get(id)) throw new Error('Report not found');
      db.prepare('INSERT OR REPLACE INTO report_reviews VALUES (?, ?, ?, ?)').run(id, action, note.slice(0, 1000), Date.now());
    },
  };
}

function allowedPair(pair, policy) {
  if (!pair || !policy?.size()) return pair;
  let path;
  try { path = JSON.parse(pair.optimal_path); } catch { return null; }
  return [pair.start_title, pair.end_title, ...(Array.isArray(path) ? path : [])].some(title => policy.blocked(title)) ? null : pair;
}

module.exports = { articleKey, createArticlePolicy, allowedPair };
