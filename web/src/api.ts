const cache = new Map<string, Promise<any>>();

export async function api<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  const qs = params
    ? '?' + Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const url = `/api${path}${qs}`;
  if (cache.has(url)) return cache.get(url)!;
  const p = fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`请求失败 ${r.status}`);
      return r.json();
    })
    .catch(e => { cache.delete(url); throw e; });
  cache.set(url, p);
  if (cache.size > 240) cache.clear();
  return p;
}

export const apiUrl = (path: string) => `/api${path}`;
