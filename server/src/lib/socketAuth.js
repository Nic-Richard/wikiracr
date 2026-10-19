const { verifyToken } = require('@clerk/backend');
const clerk = require('./clerk');
const log = require('./logger');
const { getDeletionStore } = require('../db');

function guestUser(user = {}) {
  return {
    userId: null,
    username: String(user.username || 'Guest').slice(0, 40),
    isPro: false,
  };
}

function displayNameFor(user) {
  return user.username
    || user.firstName
    || user.emailAddresses?.[0]?.emailAddress?.split('@')[0]
    || 'Player';
}

async function userFromToken(token) {
  if (!token) return null;
  const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
  if (getDeletionStore()?.get(payload.sub)) return null;
  const user = await clerk.users.getUser(payload.sub);
  return {
    userId: user.id,
    username: displayNameFor(user),
    isPro: !!user.publicMetadata?.isPro,
  };
}

async function resolveSocketUser(auth = {}) {
  try {
    const verified = await userFromToken(auth.token);
    if (verified) return verified;
  } catch (err) {
    log.debug('[auth] socket token rejected:', err.message);
  }
  return guestUser(auth.user);
}

const nameCache = new Map();

// Leaderboard names come from the account, so nobody can post under someone else's name.
async function accountName(userId) {
  if (getDeletionStore()?.get(userId)) return 'Deleted user';
  const cached = nameCache.get(userId);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.name;
  const name = displayNameFor(await clerk.users.getUser(userId)).slice(0, 40);
  if (nameCache.size > 10000) nameCache.clear();
  nameCache.set(userId, { name, at: Date.now() });
  return name;
}

async function verifyProUser(token) {
  const user = await userFromToken(token);
  return user?.isPro ? user : null;
}

module.exports = { resolveSocketUser, verifyProUser, accountName, forgetAccount: id => nameCache.delete(id) };
