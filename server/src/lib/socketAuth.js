const { verifyToken } = require('@clerk/backend');
const clerk = require('./clerk');
const log = require('./logger');

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

async function verifyProUser(token) {
  const user = await userFromToken(token);
  return user?.isPro ? user : null;
}

module.exports = { resolveSocketUser, verifyProUser };
