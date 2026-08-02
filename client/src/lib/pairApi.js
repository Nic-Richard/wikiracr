import { apiFetch } from './apiFetch';

export async function fetchPairFromServer(difficulty) {
  const { pair } = await apiFetch(`/api/pair?difficulty=${difficulty}`);
  if (!pair) throw new Error('No pair returned');
  return pair;
}
