export const MAX_SCORE = 1_200_000;
export const SCORE_TIME_CAP_SECONDS = 300;
export const SCORE_CLICK_CAP_OVER_PAR = 10;
export const SCORE_CLICK_WEIGHT = 0.6;
export const SCORE_TIME_WEIGHT = 0.4;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function describeScore(clicks, optimalClicks, timeSeconds) {
  if (!Number.isFinite(clicks) || !Number.isFinite(optimalClicks) || !Number.isFinite(timeSeconds)) {
    return { extraClicks: 0, clickFactor: 0, timeFactor: 0, clickScore: 0, timeScore: 0 };
  }

  const extraClicks = Math.max(0, clicks - optimalClicks);
  const clickFactor = clamp01(1 - extraClicks / SCORE_CLICK_CAP_OVER_PAR);
  const timeFactor = clamp01(1 - Math.max(0, timeSeconds) / SCORE_TIME_CAP_SECONDS);
  const clickScore = Math.round(MAX_SCORE * SCORE_CLICK_WEIGHT * clickFactor);
  const timeScore = Math.round(MAX_SCORE * SCORE_TIME_WEIGHT * timeFactor);

  return { extraClicks, clickFactor, timeFactor, clickScore, timeScore };
}

export function calcScore(clicks, optimalClicks, timeSeconds) {
  const parts = describeScore(clicks, optimalClicks, timeSeconds);
  return Math.max(0, Math.min(MAX_SCORE, parts.clickScore + parts.timeScore));
}
