const { ActionError } = require('./moderationAuth');
const { articleKey } = require('./articlePolicy');

function createReportModeration(db, policy) {
  db.exec(`CREATE TABLE IF NOT EXISTS moderation_actions (
    request_id TEXT PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    action TEXT NOT NULL, actor_id TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL
  )`);
  return data => {
    if (data.target.kind !== 'report' || !/^\d{1,12}$/.test(data.target.id)) throw new ActionError('Invalid report target', 400);
    return db.transaction(() => {
      const previous = db.prepare('SELECT * FROM moderation_actions WHERE request_id = ?').get(data.requestId);
      if (previous) {
        if (String(previous.report_id) !== data.target.id || previous.action !== data.action) throw new ActionError('That request belongs to another action');
        return JSON.parse(previous.result);
      }
      const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(Number(data.target.id));
      if (!report) throw new ActionError('Report no longer exists', 404);
      const review = db.prepare('SELECT * FROM report_reviews WHERE report_id = ?').get(report.id);
      const latest = db.prepare('SELECT result FROM moderation_actions WHERE report_id = ? ORDER BY rowid DESC LIMIT 1').get(report.id);
      let context = {}; try { context = JSON.parse(report.context || '{}'); } catch {}
      const block = report.type === 'article' ? db.prepare('SELECT * FROM blocked_articles WHERE title_key = ?').get(articleKey(context.articleTitle)) : null;
      const last = latest ? JSON.parse(latest.result) : null;
      const state = { ok: true, status: review?.action || 'open', version: `${report.created_at}:${review?.action || 'open'}:${review?.reviewed_at || ''}:${last?.requestId || ''}:${block?.created_at || ''}`,
        title: report.type === 'article' ? `Article: ${String(context.articleTitle || '').slice(0, 300)}` : `${report.type} report #${report.id}`,
        viewUrl: report.type === 'article' && typeof context.articleTitle === 'string' ? `https://en.wikipedia.org/wiki/${encodeURIComponent(context.articleTitle.replaceAll(' ', '_'))}` : null,
        summary: String(report.message || '').slice(0, 1000), actor: latest ? JSON.parse(latest.result).actor : null,
        references: [String(report.id), report.user_id, context.reportedUserId].filter(Boolean).map(String),
        actions: review ? ['reopen', ...(report.type === 'article' ? [block ? 'unblock' : 'blacklist'] : [])] : report.type === 'article' ? [...(block ? ['unblock'] : ['blacklist']), 'dismiss'] : ['resolve', 'dismiss'],
        confirmations: { reopen: 'Reopen this report for review. Any global article block remains in place.', unblock: 'Remove this article from the global blacklist for every player. Race pairs containing it become eligible again.' },
        confirmation: 'Blacklisting applies to every player and excludes race pairs containing this article.',
      };
      if (data.action === 'inspect') return state;
      if (review && !state.actions.includes(data.action)) return { ...state, changed: false, summary: 'This report was already handled in the app' };
      if (state.version !== data.expectedVersion || !state.actions.includes(data.action)) throw new ActionError('Report changed; review it again');
      const action = { blacklist: 'blocked', resolve: 'actioned', dismiss: 'dismissed', reopen: 'open', unblock: 'dismissed' }[data.action];
      if (data.action === 'blacklist') {
        if (typeof context.articleTitle !== 'string' || !context.articleTitle.trim()) throw new ActionError('The report has no article target', 400);
        if (!policy.blocked(context.articleTitle)) policy.block(context.articleTitle, `Report #${report.id} approved by Discord moderator ${data.actor.id}`);
      }
      if (data.action === 'unblock') policy.unblock(context.articleTitle);
      if (data.action === 'reopen') db.prepare('DELETE FROM report_reviews WHERE report_id = ?').run(report.id);
      else policy.review(report.id, action, `Discord moderator ${data.actor.id}: ${data.action}`);
      const result = { ok: true, changed: true, status: action, summary: data.action === 'blacklist' ? 'Article blacklisted globally and report resolved' : data.action === 'unblock' ? 'Article unblocked globally and report dismissed' : `Report ${action}`, actor: data.actor, requestId: data.requestId, at: Date.now() };
      db.prepare('INSERT INTO moderation_actions VALUES (?, ?, ?, ?, ?, ?)').run(data.requestId, report.id, data.action, data.actor.id, JSON.stringify(result), Date.now());
      const currentReview = db.prepare('SELECT * FROM report_reviews WHERE report_id = ?').get(report.id);
      const currentBlock = report.type === 'article' ? db.prepare('SELECT * FROM blocked_articles WHERE title_key = ?').get(articleKey(context.articleTitle)) : null;
      result.version = `${report.created_at}:${currentReview?.action || 'open'}:${currentReview?.reviewed_at || ''}:${result.requestId}:${currentBlock?.created_at || ''}`;
      result.actions = currentReview ? ['reopen', ...(report.type === 'article' ? [currentBlock ? 'unblock' : 'blacklist'] : [])] : report.type === 'article' ? [...(currentBlock ? ['unblock'] : ['blacklist']), 'dismiss'] : ['resolve', 'dismiss'];
      db.prepare('UPDATE moderation_actions SET result = ? WHERE request_id = ?').run(JSON.stringify(result), data.requestId);
      return result;
    })();
  };
}
module.exports = { createReportModeration };
