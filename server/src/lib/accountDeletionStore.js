function createDeletionStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS account_deletions (
    user_id TEXT PRIMARY KEY, references_json TEXT NOT NULL, cursor_json TEXT NOT NULL DEFAULT '{}',
    state TEXT NOT NULL DEFAULT 'pending', requested_at INTEGER NOT NULL, next_attempt_at INTEGER NOT NULL,
    alerts_erased INTEGER NOT NULL DEFAULT 0, completed_at INTEGER
  )`);
  function get(userId) {
    const row = db.prepare('SELECT * FROM account_deletions WHERE user_id = ?').get(userId);
    return row && { ...row, references: JSON.parse(row.references_json), cursor: JSON.parse(row.cursor_json) };
  }
  function request(userId, references, now = Date.now()) {
    db.prepare(`INSERT OR IGNORE INTO account_deletions
      (user_id, references_json, requested_at, next_attempt_at) VALUES (?, ?, ?, ?)`)
      .run(userId, JSON.stringify(references), now, now + 60_000);
    return get(userId);
  }
  function update(userId, job) {
    const current = get(userId);
    const newerReferences = current.references.some(reference => !job.references.includes(reference));
    const addedReferences = job.references.some(reference => !current.references.includes(reference));
    job.references = [...new Set([...current.references, ...job.references])];
    // A late payment can add references while a provider call is awaiting a response.
    if (newerReferences || addedReferences) {
      job.cursor = {};
      job.alerts_erased = false;
      job.state = 'pending';
      job.completed_at = null;
      job.next_attempt_at = Date.now() + 60_000;
    }
    db.prepare(`UPDATE account_deletions SET references_json = ?, cursor_json = ?, alerts_erased = ?, state = ?,
      next_attempt_at = ?, completed_at = ? WHERE user_id = ?`)
      .run(JSON.stringify(job.references), JSON.stringify(job.cursor), job.alerts_erased ? 1 : 0, job.state,
        job.next_attempt_at, job.completed_at || null, userId);
  }
  return {
    get, request, update,
    addReferences: (userId, references) => {
      const job = get(userId);
      if (!job) return;
      job.references = [...new Set([...job.references, ...references.filter(Boolean)])];
      update(userId, job);
    },
    forReference: reference => db.prepare('SELECT user_id FROM account_deletions, json_each(references_json) WHERE json_each.value = ? LIMIT 1').get(reference),
    due: (now = Date.now()) => db.prepare("SELECT user_id FROM account_deletions WHERE state != 'complete' AND next_attempt_at <= ? LIMIT 20").all(now).map(row => get(row.user_id)),
    expire: (now = Date.now()) => db.prepare('DELETE FROM account_deletions WHERE completed_at < ?').run(now - 30 * 86400000),
  };
}

module.exports = { createDeletionStore };
