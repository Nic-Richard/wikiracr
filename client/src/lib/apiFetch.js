// Normalize API failures before they reach the UI.
export async function apiFetch(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error('Something went wrong. Please try again.');
    throw new Error('Unexpected response from the server. Please try again.');
  }

  if (!res.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
  return data;
}
