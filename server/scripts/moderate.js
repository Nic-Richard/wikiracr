#!/usr/bin/env node
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const Database = require('better-sqlite3');
const { createArticlePolicy } = require('../src/lib/articlePolicy');
const { resolveTitle } = require('../src/lib/wikiTitle');

async function main() {
  const [command, value, ...rest] = process.argv.slice(2);
  if (!['reports', 'list', 'block', 'unblock', 'review'].includes(command)) throw new Error('Usage: moderate.js reports | list | block "Title" "Reason" | unblock "Title" | review ID blocked|dismissed|actioned "Note"');
  const filename = process.env.APP_DB_PATH ? path.resolve(process.env.APP_DB_PATH) : path.resolve(__dirname, '../../app.db');
  const db = new Database(filename, { fileMustExist: true });
  try {
    db.pragma('foreign_keys = ON');
    const policy = createArticlePolicy(db);
    if (command === 'reports') console.log(JSON.stringify(policy.pending(), null, 2));
    if (command === 'list') console.log(JSON.stringify(policy.list(), null, 2));
    if (command === 'block') {
      const title = await resolveTitle(value);
      if (!rest.join(' ').trim()) throw new Error('A block reason is required');
      db.transaction(() => { policy.block(title, rest.join(' ')); policy.block(value, rest.join(' ')); })();
      console.log(`Blocked: ${title}`);
    }
    if (command === 'unblock') {
      if (typeof value !== 'string' || !value.trim()) throw new Error('An article title is required');
      let title = value;
      try { title = await resolveTitle(value); } catch {}
      db.transaction(() => {
        for (const entry of policy.list()) if (entry.title === title || entry.title === value) policy.unblock(entry.title);
      })();
      console.log(`Unblocked: ${title}. Check list for any separately blocked aliases.`);
    }
    if (command === 'review') { policy.review(Number(value), rest[0], rest.slice(1).join(' ')); console.log('Report review saved.'); }
  } finally { db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
