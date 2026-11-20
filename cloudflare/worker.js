/**
 * 墨澜 · Cloudflare Worker（免费静态方案）
 *
 * - 诗库正文、索引、诗人、典籍全部由 Workers Static Assets 托管。
 * - D1 只存 token_index（单字/高频二元组 -> 诗序号），不存诗库。
 * - Worker 唯一的动态接口：/api/search-candidates
 */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function sendJson(data, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, 'Cache-Control': cache },
  });
}

function cjkQuery(q) {
  return [...String(q || '').normalize('NFC')].filter(ch => /\p{Script=Han}/u.test(ch));
}

function decodeIds(hex) {
  if (!hex) return [];
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const out = [];
  let value = 0;
  let shift = 0;
  let id = 0;
  let first = true;
  for (const byte of bytes) {
    value += (byte & 0x7f) << shift;
    if (byte & 0x80) {
      shift += 7;
      continue;
    }
    if (first) { id = value; first = false; }
    else { id += value; }
    out.push(id);
    value = 0;
    shift = 0;
  }
  return out;
}

function intersectIds(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push(a[i]); i++; j++; }
    else if (a[i] < b[j]) i++;
    else j++;
  }
  return out;
}

async function queryTokens(env, tokens) {
  if (!tokens.length) return new Map();
  const rows = await env.DB.prepare(
    `SELECT token, seq, hex(ids) AS h FROM token_index
     WHERE token IN (${tokens.map(() => '?').join(',')})
     ORDER BY token, seq`
  ).bind(...tokens).all();
  const map = new Map();
  for (const row of rows.results || []) {
    let arr = map.get(row.token);
    if (!arr) { arr = []; map.set(row.token, arr); }
    arr.push(...decodeIds(row.h));
  }
  return map;
}

async function searchCandidates(env, q) {
  const chars = cjkQuery(q);
  if (!chars.length) return { mode: 'none', tokens: [], ids: [], total: 0 };

  let tokens, mode;
  if (chars.length === 1) {
    tokens = ['c:' + chars[0]];
    mode = 'char';
  } else {
    tokens = [];
    for (let i = 0; i + 1 < chars.length; i++) {
      tokens.push('b:' + chars[i] + chars[i + 1]);
    }
    mode = 'bigram';
  }

  let map = await queryTokens(env, tokens);
  const missing = tokens.some(t => !map.has(t));
  if (mode === 'bigram' && missing) {
    tokens = chars.map(ch => 'c:' + ch);
    mode = 'char';
    map = await queryTokens(env, tokens);
  }

  const lists = tokens.map(t => map.get(t) || []);
  if (lists.some(list => !list.length)) {
    return { mode, tokens, ids: [], total: 0 };
  }
  let ids = lists[0];
  for (let i = 1; i < lists.length; i++) ids = intersectIds(ids, lists[i]);
  return { mode, tokens, ids, total: ids.length };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return sendJson({ ok: true, d1: !!env.DB });
    }

    if (url.pathname === '/api/search-candidates') {
      if (!env.DB) return sendJson({ error: 'no_index' }, 503);
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return sendJson({ mode: 'none', tokens: [], ids: [], total: 0 });

      // Cache identical searches at the edge; the token index is read-only.
      const cache = caches.default;
      const key = new Request(url.toString(), { method: 'GET' });
      const cached = await cache.match(key);
      if (cached) return cached;

      try {
        const result = await searchCandidates(env, q);
        const res = sendJson(result, 200, 'public, max-age=3600');
        await cache.put(key, res.clone());
        return res;
      } catch (err) {
        return sendJson({ error: String(err?.message || err) }, 500);
      }
    }

    // 其余路径全部交给静态资源；SPA 回退由 not_found_handling 处理。
    return env.ASSETS.fetch(request);
  },
};
