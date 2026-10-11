const express = require('express');
const log = require('../lib/logger');
const { sendAlert } = require('../lib/alerts');
const { rateLimit } = require('../lib/rateLimit');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const clerk   = require('../lib/clerk');
const { requireAuth, optionalAuth, requirePro } = require('../middleware/auth');
const {
  getPair, getDailyChallenge, getUserStats,
  getUserHistory, getDailyLeaderboard, upsertDailyScore,
  getUserDailyResult, getUserStreak, getUserBestStreak,
  getDailyProgress, saveDailyProgress, clearDailyProgress,
  getDailyClock, updateDailyClock,
  upsertSpeedrunScore, getSpeedrunLeaderboard, getUserSpeedrunBests,
  getEloLeaderboard, getUserElo,
  saveGameHistory,
  getHigherLowerBest, upsertHigherLowerStreak,
  saveReport,
} = require('../db');
const { getRoom } = require('../game/GameManager');
const { accountName } = require('../lib/socketAuth');
const { verifyPath, checkClicks, cleanClientHistory, MIN_SECONDS_PER_CLICK } = require('../game/pathCheck');
const speedrunRuns = require('../game/speedrunRuns');
const higherLower = require('../game/higherLower');
const { calcScore } = require('../game/scoring');

function sendGameError(res, err, label) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  log.error(`[${label}] error:`, err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

router.get('/pair', (req, res) => {
  try {
    const { difficulty = 'random', pathLength } = req.query;
    const pair = getPair(difficulty, pathLength ? parseInt(pathLength) : null, getDailyChallenge()?.id);
    if (!pair) return res.status(404).json({ error: 'No pairs available for this difficulty' });
    res.json({ pair: { id: pair.id, startTitle: pair.start_title, endTitle: pair.end_title, pathLength: pair.path_length, optimalPath: JSON.parse(pair.optimal_path) } });
  } catch (err) {
    log.error('[pair] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/daily', (req, res) => {
  const pair = getDailyChallenge();
  if (!pair) return res.status(404).json({ error: 'No daily challenge available' });
  const today = new Date().toISOString().split('T')[0];
  res.json({
    date: today,
    pair: {
      id: pair.id, startTitle: pair.start_title, endTitle: pair.end_title,
      pathLength: pair.path_length,
    },
  });
});

router.get('/daily/status', requireAuth, (req, res) => {
  const today  = new Date().toISOString().split('T')[0];
  const result = getUserDailyResult(req.userId, today);
  const streak = getUserStreak(req.userId);
  const pair = result ? getDailyChallenge() : null;
  res.json({
    completed: !!result,
    result: result ? { score: result.score, clicks: result.clicks, timeSeconds: result.time_seconds } : null,
    progress: result ? null : getDailyProgress(req.userId, today),
    streak,
    date: today,
    pair: pair ? { id: pair.id, startTitle: pair.start_title, endTitle: pair.end_title,
      pathLength: pair.path_length, optimalPath: JSON.parse(pair.optimal_path) } : null,
  });
});

router.post('/daily/clock', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  if (req.body?.date !== today || typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ error: 'Invalid daily clock request' });
  }
  if (getUserDailyResult(req.userId, today)) return res.status(409).json({ error: 'Already completed today' });
  res.json(updateDailyClock(req.userId, today, req.body.active));
});

router.post('/daily/finish', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    if (req.body?.date !== today) return res.status(400).json({ error: 'This daily challenge has ended' });
    const pair = getDailyChallenge();
    if (!pair) return res.status(404).json({ error: 'No daily challenge available' });
    const hops = await verifyPath(req.body.path, pair.start_title, pair.end_title);
    checkClicks(req.body.clicks, hops);
    res.json({ optimalPath: JSON.parse(pair.optimal_path) });
  } catch (err) {
    sendGameError(res, err, 'daily');
  }
});

router.post('/daily/progress', requireAuth, (req, res) => {
  const { navHist, histIdx, clicks } = req.body;
  const today = new Date().toISOString().split('T')[0];
  if (!Array.isArray(navHist) || navHist.length < 1 || navHist.length > 1000
    || navHist.some(title => typeof title !== 'string' || title.length > 300)
    || !Number.isInteger(histIdx) || histIdx < 0 || histIdx >= navHist.length
    || !Number.isInteger(clicks) || clicks < 0 || clicks > 1000) {
    return res.status(400).json({ error: 'Invalid progress payload' });
  }
  if (getUserDailyResult(req.userId, today)) return res.status(409).json({ error: 'Already completed today' });
  saveDailyProgress(req.userId, today, navHist, histIdx, clicks, getDailyClock(req.userId, today)?.elapsedMs || 0);
  res.json({ ok: true });
});

router.get('/room/:code', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ state: room.getPublicState() });
});


router.get('/me/stats', requireAuth, (req, res) => {
  const stats = getUserStats(req.userId);
  res.json({ stats });
});

router.get('/me/profile', requireAuth, (req, res) => {
  res.json({
    stats:          getUserStats(req.userId),
    elo:            getUserElo(req.userId),
    dailyStreak:    getUserStreak(req.userId),
    bestDailyStreak: getUserBestStreak(req.userId),
    speedrunBests:  getUserSpeedrunBests(req.userId),
  });
});

router.get('/me/history', requireAuth, (req, res) => {
  const history = getUserHistory(req.userId, 20);
  res.json({ history });
});

router.post('/me/game', requireAuth, (req, res) => {
  saveGameHistory(cleanClientHistory(req.userId, req.body));
  res.json({ ok: true });
});

router.get('/leaderboard/daily', (req, res) => {
  const { date } = req.query;
  const board = getDailyLeaderboard(date);
  res.json({ leaderboard: board });
});

router.post('/leaderboard/daily', requireAuth, async (req, res) => {
  const { clicks, path } = req.body;
  const today = new Date().toISOString().split('T')[0];

  if (getUserDailyResult(req.userId, today)) {
    return res.status(409).json({ error: 'Already submitted a result for today' });
  }

  try {
    if (req.body.date !== today) return res.status(400).json({ error: 'This daily challenge has ended' });
    if (!getDailyClock(req.userId, today)) return res.status(409).json({ error: 'Start the daily challenge before submitting' });
    const timeSeconds = updateDailyClock(req.userId, today, false).elapsedMs / 1000;
    const pair = getDailyChallenge();
    if (!pair) return res.status(404).json({ error: 'No daily challenge available' });
    const hops = await verifyPath(path, pair.start_title, pair.end_title);
    checkClicks(clicks, hops);
    if (!Number.isFinite(timeSeconds) || timeSeconds < hops * MIN_SECONDS_PER_CLICK || timeSeconds > 7 * 86400) {
      return res.status(400).json({ error: 'Invalid time' });
    }
    const username = await accountName(req.userId);
    const score = calcScore(clicks, pair.path_length, timeSeconds);
    const saved = upsertDailyScore({ userId: req.userId, username, date: today, score, clicks, timeSeconds: Math.round(timeSeconds) });
    if (!saved.changes) return res.status(409).json({ error: 'Already submitted a result for today' });
    clearDailyProgress(req.userId, today);
    res.json({ ok: true, streak: getUserStreak(req.userId), timeSeconds: Math.round(timeSeconds),
      optimalPath: JSON.parse(pair.optimal_path) });
  } catch (err) {
    sendGameError(res, err, 'daily');
  }
});

const SPEEDRUN_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'random'];

router.get('/leaderboard/speedrun', (req, res) => {
  const { difficulty = 'random' } = req.query;
  if (!SPEEDRUN_DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: 'Invalid difficulty' });
  }
  res.json({ leaderboard: getSpeedrunLeaderboard(difficulty) });
});

router.post('/speedrun/start', (req, res) => {
  const { difficulty = 'random' } = req.body || {};
  if (!SPEEDRUN_DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: 'Invalid difficulty' });
  }
  try {
    res.json(speedrunRuns.startRun(difficulty));
  } catch (err) {
    sendGameError(res, err, 'speedrun');
  }
});

router.post('/speedrun/:runId/next', async (req, res) => {
  try {
    res.json(await speedrunRuns.nextRound(req.params.runId, req.body));
  } catch (err) {
    sendGameError(res, err, 'speedrun');
  }
});

router.post('/speedrun/:runId/finish', async (req, res) => {
  try {
    res.json(await speedrunRuns.finishRun(req.params.runId, req.body?.rounds));
  } catch (err) {
    sendGameError(res, err, 'speedrun');
  }
});

router.post('/leaderboard/speedrun', requireAuth, async (req, res) => {
  try {
    const { runId, rounds } = req.body || {};
    const result = await speedrunRuns.finishRun(runId, rounds);
    const username = await accountName(req.userId);
    upsertSpeedrunScore({ userId: req.userId, username, ...result });
    res.json({ ok: true, totalSeconds: result.totalSeconds });
  } catch (err) {
    sendGameError(res, err, 'speedrun');
  }
});

router.get('/leaderboard/elo', (req, res) => {
  res.json({ leaderboard: getEloLeaderboard() });
});

router.get('/me/elo', requireAuth, (req, res) => {
  res.json(getUserElo(req.userId));
});

router.get('/higherlower/best', requireAuth, (req, res) => {
  res.json({ best: getHigherLowerBest(req.userId) });
});

router.post('/higherlower/start', optionalAuth, async (req, res) => {
  try {
    res.json(await higherLower.startGame(req.userId));
  } catch (err) {
    sendGameError(res, err, 'higherlower');
  }
});

router.post('/higherlower/:gameId/guess', async (req, res) => {
  try {
    const { userId, ...result } = higherLower.guess(req.params.gameId, req.body?.pick);
    let best = null;
    if (userId && result.streak > 0) {
      best = upsertHigherLowerStreak({ userId, username: await accountName(userId), streak: result.streak });
    }
    res.json({ ...result, best });
  } catch (err) {
    sendGameError(res, err, 'higherlower');
  }
});

router.post('/higherlower/:gameId/next', async (req, res) => {
  try {
    res.json(await higherLower.nextPair(req.params.gameId));
  } catch (err) {
    sendGameError(res, err, 'higherlower');
  }
});

const REPORT_TYPES = ['pair', 'bug', 'other'];

const reportLimit = rateLimit({
  limit: 10,
  windowMs: 60 * 60 * 1000,
  key: (req) => req.userId || req.ip,
  message: 'Too many reports. Try again in a little while.',
});

router.post('/report', optionalAuth, reportLimit, (req, res) => {
  const { type, message, context } = req.body;
  if (!REPORT_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid report type' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long' });
  }
  saveReport({ type, message, context, userId: req.userId || null });
  const details = context && typeof context === 'object' ? Object.entries(context).slice(0, 8) : [];
  sendAlert(type === 'pair' ? 'reports' : 'bugs', {
    title: { pair: 'Pair report', bug: 'Bug report', other: 'Feedback' }[type],
    description: message.slice(0, 2000),
    fields: [
      { name: 'From', value: req.userId || 'Signed out' },
      ...details.map(([name, value]) => ({ name, value: JSON.stringify(value).slice(0, 300) })),
    ],
  });
  res.json({ ok: true });
});


router.post('/stripe/create-checkout', requireAuth, async (req, res) => {
  log.debug('[stripe] checkout requested by userId:', req.userId);
  try {
    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      line_items:           [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url:          `${process.env.CLIENT_URL}/upgrade/success`,
      cancel_url:           `${process.env.CLIENT_URL}/upgrade`,
      metadata:             { clerkUserId: req.userId },
      subscription_data:    { metadata: { clerkUserId: req.userId } },
    });
    log.debug('[stripe] session created:', session.id);
    res.json({ url: session.url });
  } catch (err) {
    log.error('[stripe] checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/stripe/create-portal-session', requireAuth, async (req, res) => {
  try {
    const user = await clerk.users.getUser(req.userId);
    const customerId = user.publicMetadata?.stripeCustomerId;
    if (!customerId) {
      return res.status(400).json({ error: 'No subscription found for this account' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${process.env.CLIENT_URL}/account`,
    });
    res.json({ url: session.url });
  } catch (err) {
    log.error('[stripe] portal session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    log.warn('[webhook] signature verification failed:', err.message);
    sendAlert('billing', {
      title: 'Stripe webhook refused: bad signature',
      description: "Check STRIPE_WEBHOOK_SECRET against the endpoint's signing secret.",
      key: 'stripe-signature',
    });
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  log.debug('[webhook] event received:', event.type);

  try {
    if (event.type === 'checkout.session.completed') {
      const session     = event.data.object;
      const clerkUserId = session.metadata?.clerkUserId;
      if (!clerkUserId) {
        log.error('[webhook] no clerkUserId in session metadata');
        return res.json({ received: true });
      }

      if (session.customer) {
        await stripe.customers.update(session.customer, {
          metadata: { clerkUserId },
        });
      }

      const user = await clerk.users.getUser(clerkUserId);
      await clerk.users.updateUser(clerkUserId, {
        publicMetadata: {
          ...user.publicMetadata,
          isPro:                true,
          stripeCustomerId:     session.customer,
          stripeSubscriptionId: session.subscription,
        },
      });
      log.info('[webhook] Pro granted to:', clerkUserId);
      sendAlert('billing', {
        title: 'Pro started',
        fields: [{ name: 'User', value: clerkUserId }, { name: 'Customer', value: session.customer }],
      });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription  = event.data.object;
      const stripeCustomer = await stripe.customers.retrieve(subscription.customer);
      const clerkUserId   = stripeCustomer.metadata?.clerkUserId;

      if (!clerkUserId) {
        log.error('[webhook] no clerkUserId on customer metadata');
        return res.json({ received: true });
      }

      const user = await clerk.users.getUser(clerkUserId);
      await clerk.users.updateUser(clerkUserId, {
        publicMetadata: {
          ...user.publicMetadata,
          isPro:                false,
          stripeSubscriptionId: null,
        },
      });
      log.info('[webhook] Pro revoked for:', clerkUserId);
      sendAlert('billing', {
        title: 'Pro ended',
        fields: [{ name: 'User', value: clerkUserId }, { name: 'Customer', value: subscription.customer }],
      });
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      log.info('[webhook] payment failed for customer:', invoice.customer);
      sendAlert('billing', {
        title: 'Pro payment failed',
        fields: [{ name: 'Customer', value: invoice.customer }],
      });
    }
  } catch (err) {
    log.error('[webhook] handler error:', err.message);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }

  res.json({ received: true });
});

module.exports = router;
