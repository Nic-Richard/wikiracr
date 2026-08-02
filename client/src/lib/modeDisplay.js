import { formatTime } from './format';

export function formatStandingValue(mode, row) {
  switch (mode) {
    case 'classic':  return `${row.roundWins} round${row.roundWins !== 1 ? 's' : ''}`;
    case 'score':    return `${Number(row.totalScore || 0).toLocaleString()} pts`;
    case 'clicks':   return `${row.totalClicks} click${row.totalClicks !== 1 ? 's' : ''}`;
    case 'speedrun': return formatTime(row.totalTimeSeconds);
    case 'knockout': return row.eliminated ? 'OUT' : `${row.hp} HP`;
    default:         return '';
  }
}

export function isRowOut(row) {
  return !!row.eliminated;
}
