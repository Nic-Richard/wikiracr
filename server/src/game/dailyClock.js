// A closed tab or lost connection must not leave the daily clock running indefinitely.
const HEARTBEAT_GRACE_MS = 30_000;

function advanceClock(clock, active, now = Date.now()) {
  const elapsedMs = (clock?.elapsedMs || 0) + (clock?.activeAt == null ? 0
    : Math.max(0, Math.min(HEARTBEAT_GRACE_MS, now - clock.activeAt)));
  return { elapsedMs, activeAt: active ? now : null };
}

module.exports = { advanceClock };
