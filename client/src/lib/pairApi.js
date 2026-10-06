import { apiFetch } from './apiFetch';

const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export async function startSpeedrun(difficulty) {
  const { runId, pair } = await apiFetch('/api/speedrun/start', post({ difficulty }));
  if (!runId || !pair) throw new Error('No pair returned');
  return { runId, pair };
}

export async function nextSpeedrunPair(runId, round) {
  const { pair, completedRound } = await apiFetch(`/api/speedrun/${encodeURIComponent(runId)}/next`, post(round));
  if (!pair) throw new Error('No pair returned');
  return { pair, completedRound };
}

export function finishSpeedrun(runId, rounds) {
  return apiFetch(`/api/speedrun/${encodeURIComponent(runId)}/finish`, post({
    rounds: rounds.map(({ path, clicks }) => ({ path, clicks })),
  }));
}

export async function fetchPairFromServer(difficulty) {
  const { pair } = await apiFetch(`/api/pair?difficulty=${difficulty}`);
  if (!pair) throw new Error('No pair returned');
  return pair;
}
