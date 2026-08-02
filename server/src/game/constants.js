const MODES = ['classic', 'score', 'clicks', 'speedrun', 'knockout'];

const ROUND_OPTIONS = {
  classic: [3, 5, 7, 9],
  score: [1, 3, 5, 7, 9, 10],
  clicks: [1, 3, 5, 7, 9, 10],
  speedrun: [1, 3, 5, 7, 9, 10],
};

const DEFAULT_ROOM_OPTIONS = {
  mode: 'classic',
  rounds: 5,
  maxPlayers: 2,
  timeout: 0,
  sprintSeconds: 60,
  pathLength: null,
  customPair: null,
};

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'random'];

const MAX_SKIPS = 3;
const DEFAULT_HP = 6000;
const DISCONNECT_GRACE_MS = 30000;

module.exports = {
  MODES,
  ROUND_OPTIONS,
  DEFAULT_ROOM_OPTIONS,
  VALID_DIFFICULTIES,
  MAX_SKIPS,
  DEFAULT_HP,
  DISCONNECT_GRACE_MS,
};
