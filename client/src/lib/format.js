export function formatTime(totalSeconds) {
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function normalizeTitle(title) {
  return title?.replace(/_/g, ' ') ?? '';
}
