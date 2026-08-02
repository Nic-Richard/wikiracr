const express = require('express');
const log = require('../lib/logger');
const router  = express.Router();
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const clerk   = require('../lib/clerk');
const { requireAuth, optionalAuth, requirePro } = require('../middleware/auth');
const {
  getPair, getDailyChallenge, getUserStats,
  getUserHistory, getDailyLeaderboard, upsertDailyScore,
  getUserDailyResult, getUserStreak, getUserBestStreak, getHigherLowerArticles,
  getDailyProgress, saveDailyProgress, clearDailyProgress,
  upsertSpeedrunScore, getSpeedrunLeaderboard, getUserSpeedrunBests,
  getEloLeaderboard, getUserElo,
  saveGameHistory,
  getHigherLowerBest, upsertHigherLowerStreak,
  saveReport,
} = require('../db');
const { getRoom } = require('../game/GameManager');

router.get('/pair', (req, res) => {
  try {
    const { difficulty = 'random', pathLength } = req.query;
    const pair = getPair(difficulty, pathLength ? parseInt(pathLength) : null);
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
      pathLength: pair.path_length, optimalPath: JSON.parse(pair.optimal_path),
    },
  });
});

router.get('/daily/status', requireAuth, (req, res) => {
  const today  = new Date().toISOString().split('T')[0];
  const result = getUserDailyResult(req.userId, today);
  const streak = getUserStreak(req.userId);
  res.json({
    completed: !!result,
    result: result ? { score: result.score, clicks: result.clicks, timeSeconds: result.time_seconds } : null,
    progress: result ? null : getDailyProgress(req.userId, today),
    streak,
    date: today,
  });
});

router.post('/daily/progress', requireAuth, (req, res) => {
  const { navHist, histIdx, clicks, elapsedMs } = req.body;
  const today = new Date().toISOString().split('T')[0];
  if (!Array.isArray(navHist) || typeof histIdx !== 'number' || typeof clicks !== 'number') {
    return res.status(400).json({ error: 'Invalid progress payload' });
  }
  const safeElapsedMs = typeof elapsedMs === 'number' && elapsedMs >= 0 ? elapsedMs : 0;
  saveDailyProgress(req.userId, today, navHist, histIdx, clicks, safeElapsedMs);
  res.json({ ok: true });
});

router.get('/room/:code', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ state: room.getPublicState() });
});

router.get('/higherlower/articles', (req, res) => {
  res.json({ articles: getHigherLowerArticles() });
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
  const { pairId, path, clicks, timeSeconds, completed, score, mode } = req.body;
  saveGameHistory({
    userId: req.userId, pairId, pathTaken: path,
    clicks, timeSeconds, completed, score, mode,
  });
  res.json({ ok: true });
});

router.get('/leaderboard/daily', (req, res) => {
  const { date } = req.query;
  const board = getDailyLeaderboard(date);
  res.json({ leaderboard: board });
});

router.post('/leaderboard/daily', requireAuth, (req, res) => {
  const { username, score, clicks, timeSeconds } = req.body;
  const today = new Date().toISOString().split('T')[0];

  if (getUserDailyResult(req.userId, today)) {
    return res.status(409).json({ error: 'Already submitted a result for today' });
  }

  upsertDailyScore({ userId: req.userId, username, date: today, score, clicks, timeSeconds });
  clearDailyProgress(req.userId, today);
  res.json({ ok: true, streak: getUserStreak(req.userId) });
});

const SPEEDRUN_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'random'];

router.get('/leaderboard/speedrun', (req, res) => {
  const { difficulty = 'random' } = req.query;
  if (!SPEEDRUN_DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: 'Invalid difficulty' });
  }
  res.json({ leaderboard: getSpeedrunLeaderboard(difficulty) });
});

router.post('/leaderboard/speedrun', requireAuth, (req, res) => {
  const { username, difficulty, totalSeconds, clicks } = req.body;
  if (!SPEEDRUN_DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: 'Invalid difficulty' });
  }
  upsertSpeedrunScore({ userId: req.userId, username, difficulty, totalSeconds, clicks });
  res.json({ ok: true });
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

router.post('/higherlower/streak', requireAuth, (req, res) => {
  const { username, streak } = req.body;
  if (typeof streak !== 'number' || streak < 0) {
    return res.status(400).json({ error: 'Invalid streak' });
  }
  const best = upsertHigherLowerStreak({ userId: req.userId, username, streak });
  res.json({ ok: true, best });
});

const REPORT_TYPES = ['pair', 'bug', 'other'];

router.post('/report', optionalAuth, (req, res) => {
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
    log.error('[webhook] signature verification failed:', err.message);
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
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      log.info('[webhook] payment failed for customer:', invoice.customer);
    }
  } catch (err) {
    log.error('[webhook] handler error:', err.message);
  }

  res.json({ received: true });
});

module.exports = router;
