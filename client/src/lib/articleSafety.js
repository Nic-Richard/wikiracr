import { appFetch } from './platform';

export async function checkArticle(title) {
  const response = await appFetch(`/api/articles/check?title=${encodeURIComponent(title)}`);
  if (!response.ok) throw new Error('Could not check this article. Try again.');
  const result = await response.json();
  if (!result.allowed) throw new Error('This article is unavailable in WikiRacr. Go back or leave this race.');
  return result.title;
}
