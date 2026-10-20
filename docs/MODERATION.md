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

Blocks persist in the database and take effect on subsequent server checks without an
API restart. Titles normalize spaces, underscores, encoded characters and case. Blocking
resolves Wikipedia redirects and records the requested and canonical title. Article
checks resolve redirects while any global blocks exist, using a bounded five-minute
canonical-title cache; blocked status itself is always read from the current database.
Unblocking a canonical title may leave separately blocked aliases: inspect `list`.

Random/custom/daily pairs whose known start, goal or optimal path includes a blocked
title are excluded. Higher or Lower excludes blocked candidates and checks redirects
before dealing. Authoritative link and back/forward navigation checks reject blocked
destinations. Existing daily results are retained; a blocked daily pair is unavailable
instead of silently replacing the day's ranked challenge.

The updated client checks the article policy before fetching Wikipedia HTML or Higher
or Lower summaries. It stops on policy/provider errors. This is an app access control,
not a restriction on visiting Wikipedia outside WikiRacr, a guarantee that all sensitive
content is detected, or retroactive erasure of a page already open on a device.

Deploy the matching API before the new web/app client; then replace the Internal bundle.
Old app builds do not send the new chat-rules acknowledgment and cannot send chat after
the API update. Existing articles/solo games outside the new client do not gain the new
display checks. Release notes and final phone checks must account for updating the app.

No age verification, parental consent or automated review is implied by the chat agreement.
Keep declarations accurate and review Google's feedback during the normal release process.
