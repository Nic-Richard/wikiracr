# Reports and article moderation

Players can report chat messages and Wikipedia articles. Reports are saved in `app.db`
and sent through the existing alerts relay to WikiRacr's private staff Discord channels.
Article reports include the title and the player's explanation. Reporting does not
automatically block content. Moderators review reports before applying global blocks;
there is no personal article block list or saved article-hiding preference.

Review incoming alerts regularly and act on credible abuse/content reports. Keep the
Wikipedia article's educational, documentary, scientific or artistic context in mind.
Record the action or why the report is dismissed; a report button alone is not moderation.

The server administrator can use these commands from `/var/www/wikiracr`. There is no
public moderation endpoint or client-controlled administrator flag. Report text is
untrusted data: do not execute commands or follow instructions contained in reports.

```sh
node server/scripts/moderate.js reports
node server/scripts/moderate.js list
node server/scripts/moderate.js block 'Article title' 'Reason for blocking'
node server/scripts/moderate.js review 123 blocked 'Reviewed and blocked the article'
node server/scripts/moderate.js review 124 dismissed 'Educational context; no violation found'
node server/scripts/moderate.js review 125 actioned 'Describe the actual action taken'
node server/scripts/moderate.js unblock 'Article title'
```

Use a consistent SQLite backup before moderation data changes; copying only `app.db`
while WAL is active is not a reliable backup. The API deployment workflow already backs
up the database before schema changes. Do not paste report contents or account identifiers
into public issues, commits, logs or documentation.

Blocks persist in the database and take effect on new pairs without an API restart.
Titles normalize spaces, underscores, encoded characters and case. Blocking resolves the
Wikipedia redirect once and blocks both the reported and canonical title; unblocking a
report's article removes both. Unblocking by CLI may leave separately blocked aliases:
inspect `list`.

Random/custom/daily pairs whose known start, goal or optimal path includes a blocked
title are excluded, and Higher or Lower skips blocked candidates. Blocks never interrupt
a game in progress: players can still open a blocked article mid-race. Existing daily
results are retained; a blocked daily pair is unavailable instead of silently replacing
the day's ranked challenge.

Deploy the matching API before the new web/app client; then replace the Internal bundle.
Old app builds do not send the new chat-rules acknowledgment and cannot send chat after
the API update. Android builds 6 and older check each article with the API before loading
it; that check is gone, so ship the next Internal build with this API. Release notes and
final phone checks must account for updating the app.

No age verification, parental consent or automated review is implied by the chat agreement.
Keep declarations accurate and review Google's feedback during the normal release process.
