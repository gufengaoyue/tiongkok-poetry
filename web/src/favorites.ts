const KEY = 'molan-fav';

export function loadFavs(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter(x => typeof x === 'string' && x) : [];
  } catch {
    return [];
  }
}

export function saveFavs(ids: string[]): string[] {
  const unique = [...new Set(ids.filter(Boolean))];
  try { localStorage.setItem(KEY, JSON.stringify(unique)); } catch {}
  return unique;
}

export function removeFav(id: string): string[] {
  return saveFavs(loadFavs().filter(x => x !== id));
}
