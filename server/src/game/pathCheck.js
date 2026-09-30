const { isValidLink, normalise } = require('./validator');

const MAX_PATH_LENGTH = 60;
// Faster than anyone can load an article and find the next link.
const MIN_SECONDS_PER_CLICK = 1;

class PathError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Checks that a submitted path runs from start to goal through real links, one article to the next.
async function verifyPath(path, startTitle, endTitle) {
  if (!Array.isArray(path) || path.length < 2 || path.length > MAX_PATH_LENGTH
    || path.some(title => typeof title !== 'string' || !title.trim() || title.length > 300)) {
    throw new PathError('Invalid path');
  }
  if (normalise(path[0]) !== normalise(startTitle) || normalise(path[path.length - 1]) !== normalise(endTitle)) {
    throw new PathError('Path does not match this challenge');
  }
  for (let i = 0; i < path.length - 1; i++) {
    const valid = await isValidLink(path[i], path[i + 1]);
    if (valid === null) throw new PathError('Could not check your path right now. Try again.', 503);
    if (!valid) throw new PathError('Path contains a link that is not on the page');
  }
  return path.length - 1;
}

function checkClicks(clicks, hops) {
  if (!Number.isInteger(clicks) || clicks < hops || clicks > 1000) throw new PathError('Invalid click count');
}

const CLIENT_MODES = ['solo', 'daily'];
const finite = (value, max) => (Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : null);

// Solo and daily games run in the browser, so their history rows are only shaped and bounded here.
function cleanClientHistory(userId, data = {}) {
  return {
    userId,
    pairId: Number.isInteger(data.pairId) ? data.pairId : null,
    pathTaken: Array.isArray(data.path) ? data.path.slice(0, MAX_PATH_LENGTH).map(t => String(t).slice(0, 300)) : [],
    clicks: finite(data.clicks, 1000),
    timeSeconds: finite(data.timeSeconds, 86400),
    completed: !!data.completed,
    score: finite(data.score, 1_200_000),
    mode: CLIENT_MODES.includes(data.mode) ? data.mode : 'solo',
  };
}

module.exports = { verifyPath, checkClicks, cleanClientHistory, PathError, MIN_SECONDS_PER_CLICK };
