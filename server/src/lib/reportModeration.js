const { ActionError } = require('./moderationAuth');
const { articleKey } = require('./articlePolicy');

const OUTCOMES = { blacklist: 'blocked', resolve: 'actioned', dismiss: 'dismissed', reopen: 'open', unblock: 'dismissed', ban: 'actioned', unban: 'actioned' };
const SUMMARIES = {
  blacklist: 'Article blacklisted globally and report resolved',
  unblock: 'Article unblocked globally and report dismissed',
  ban: 'Player banned from chat and report resolved',
  unban: 'Player can use chat again',
};

function createReportModeration(db, policy) {
  db.exec(`CREATE TABLE IF NOT EXISTS moderation_actions (
    request_id TEXT PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    action TEXT NOT NULL, actor_id TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL
  ); CREATE TABLE IF NOT EXISTS chat_bans (
    user_id TEXT PRIMARY KEY, report_id INTEGER, actor_id TEXT NOT NULL, created_at INTEGER NOT NULL
  )`);

  function describe(report, context) {
    const review = db.prepare('SELECT * FROM report_reviews WHERE report_id = ?').get(report.id);
    const latest = db.prepare('SELECT request_id, result FROM moderation_actions WHERE report_id = ? ORDER BY rowid DESC LIMIT 1').get(report.id);
    const article = report.type === 'article';
    const block = article ? db.prepare('SELECT created_at FROM blocked_articles WHERE title_key = ?').get(articleKey(context.articleTitle)) : null;
    const player = report.type === 'player' && typeof context.reportedUserId === 'string' ? context.reportedUserId : null;
    const ban = player ? db.prepare('SELECT created_at FROM chat_bans WHERE user_id = ?').get(player) : null;
    const extra = article ? [block ? 'unblock' : 'blacklist'] : player ? [ban ? 'unban' : 'ban'] : [];
    return {
      review, latest: latest && JSON.parse(latest.result),
      version: [report.created_at, review?.action || 'open', review?.reviewed_at || '', latest?.request_id || '', block?.created_at || '', ban?.created_at || ''].join(':'),
      actions: review ? ['reopen', ...extra] : article ? [...extra, 'dismiss'] : ['resolve', 'dismiss', ...extra],
    };
  }

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
      let context = {};
      try { context = JSON.parse(report.context || '{}'); } catch {}
      const current = describe(report, context);
      const state = {
        ok: true, status: current.review?.action || 'open', version: current.version, actions: current.actions,
        title: report.type === 'article' ? `Article: ${String(context.articleTitle || '').slice(0, 300)}` : `${report.type} report #${report.id}`,
        viewUrl: report.type === 'article' && typeof context.articleTitle === 'string' ? `https://en.wikipedia.org/wiki/${encodeURIComponent(context.articleTitle.replaceAll(' ', '_'))}` : null,
        summary: String(report.message || '').slice(0, 1000), actor: current.latest?.actor || null,
        references: [String(report.id), report.user_id, context.reportedUserId].filter(Boolean).map(String),
        confirmations: {
          reopen: 'Reopen this report for review. Any global article block or chat ban remains in place.',
          unblock: 'Remove this article from the global blacklist for every player. Race pairs containing it become eligible again.',
          ban: `Stop ${String(context.username || 'this player').slice(0, 100)} from sending chat messages. Their account, games and Pro are kept. This can be undone.`,
          unban: 'Let this player use chat again.',
        },
        confirmation: 'Blacklisting applies to every player and removes race pairs containing this article. Games in progress are not interrupted.',
      };
      if (data.action === 'inspect') return state;
      if (current.review && !state.actions.includes(data.action)) return { ...state, changed: false, summary: 'This report was already handled in the app' };
      if (state.version !== data.expectedVersion || !state.actions.includes(data.action)) throw new ActionError('Report changed; review it again');

      if (data.action === 'blacklist') {
        if (typeof context.articleTitle !== 'string' || !context.articleTitle.trim()) throw new ActionError('The report has no article target', 400);
        const reason = `Report #${report.id} approved by Discord moderator ${data.actor.id}`;
        for (const title of new Set([context.articleTitle, data.canonicalTitle])) if (typeof title === 'string' && !policy.blocked(title)) policy.block(title, reason);
      }
      if (data.action === 'unblock') {
        policy.unblock(context.articleTitle);
        db.prepare('DELETE FROM blocked_articles WHERE reason LIKE ?').run(`Report #${report.id} approved by %`);
      }
      if (data.action === 'ban') db.prepare('INSERT OR IGNORE INTO chat_bans VALUES (?, ?, ?, ?)').run(context.reportedUserId, report.id, data.actor.id, Date.now());
      if (data.action === 'unban') db.prepare('DELETE FROM chat_bans WHERE user_id = ?').run(context.reportedUserId);
      const outcome = OUTCOMES[data.action];
      if (data.action === 'reopen') db.prepare('DELETE FROM report_reviews WHERE report_id = ?').run(report.id);
      else policy.review(report.id, outcome, `Discord moderator ${data.actor.id}: ${data.action}`);

      const result = { ok: true, changed: true, status: outcome, summary: SUMMARIES[data.action] || `Report ${outcome}`, actor: data.actor, requestId: data.requestId, at: Date.now() };
      db.prepare('INSERT INTO moderation_actions VALUES (?, ?, ?, ?, ?, ?)').run(data.requestId, report.id, data.action, data.actor.id, JSON.stringify(result), Date.now());
      const after = describe(report, context);
      Object.assign(result, { version: after.version, actions: after.actions });
      db.prepare('UPDATE moderation_actions SET result = ? WHERE request_id = ?').run(JSON.stringify(result), data.requestId);
      return result;
    })();
  };
}

module.exports = { createReportModeration };
