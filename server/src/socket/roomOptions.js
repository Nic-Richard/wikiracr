const { DEFAULT_ROOM_OPTIONS, VALID_DIFFICULTIES } = require('../game/constants');

function sanitizeDefaultRoomOptions(options = {}) {
  const allowed = new Set(['difficulty']);
  const extraKeys = Object.keys(options).filter(k => !allowed.has(k));
  if (extraKeys.length) {
    return { error: 'Default rooms only support difficulty. Use Custom Lobby for advanced settings.' };
  }

  const difficulty = VALID_DIFFICULTIES.includes(options.difficulty) ? options.difficulty : 'random';
  return { options: { ...DEFAULT_ROOM_OPTIONS, difficulty, isCustom: false } };
}

function sanitizeCustomRoomOptions(options = {}) {
  const rest = { ...options };
  delete rest.scoreMultiplier;
  return {
    ...rest,
    difficulty: VALID_DIFFICULTIES.includes(options.difficulty) ? options.difficulty : 'random',
    isCustom: true,
    ranked: false,
  };
}

module.exports = {
  sanitizeDefaultRoomOptions,
  sanitizeCustomRoomOptions,
};
