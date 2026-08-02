const DEBUG_GAME = process.env.DEBUG_GAME === '1';

function debug(...args) {
  if (DEBUG_GAME) console.log(...args);
}

function info(...args) {
  console.log(...args);
}

function warn(...args) {
  console.warn(...args);
}

function error(...args) {
  console.error(...args);
}

module.exports = { debug, info, warn, error };
