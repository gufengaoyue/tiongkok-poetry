import type { ClassicBook, PoetBrief, PoemBrief, PoemDetail, Stats } from './types';

/**
 * 静态数据层。
 *
 * 诗库正文放在 /data/poems/NNNN.json，每片 1000 首；
 * 浏览索引 /data/poem-index.json 只含卡片与排序需要的字段；
 * 全文检索在开发服务器下由 /api/search-candidates 返回候选序号；
 * 生产静态构建直接走 /data/token-offsets.json + 索引分片的 HTTP Range。
 */

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const ROOT = `${BASE}/data`;
const API_ROOT = `${BASE}/api`;
const jsonCache = new Map<string, Promise<any>>();
const apiCache = new Map<string, Promise<any>>();
const shardCache = new Map<number, Promise<any[]>>();
const candidateCache = new Map<string, Promise<number[]>>();
const searchStateCache = new Map<string, SearchState>();
const filterCache = new Map<string, number[]>();

type Row = [
  string, string, string, string, string, string, string, string,
  number, number, number, number, string, number, string
];

interface IndexData {
  rows: Row[];
  idOrder: number[];
  scores: number[];
  byAuthor: Map<string, number[]>;
  byRhythm: Map<string, number[]>;
  byColl: Map<string, number[]>;
}

interface PoetRow {
  id: string;
  name: string;
  dynasty: string;
  poemCount: number;
  charCount: number;
  collections: string[];
  brief: string;
  topChars: { c: string; n: number }[];
}

interface Hit {
  idx: number;
  score: number;
  where: string;
}

interface SearchState {
  hits: Hit[];
  order: { idx: number; score: number }[];
  cursor: number;
  done: boolean;
  needsExact: boolean;
}

let indexPromise: Promise<IndexData> | null = null;
let poetPromise: Promise<PoetRow[]> | null = null;

function getJson<T = any>(path: string): Promise<T> {
  const url = `${ROOT}/${path}`;
  const hit = jsonCache.get(url);
  if (hit) return hit as Promise<T>;
  const p = fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`请求失败 ${r.status}：${path}`);
      return r.json() as Promise<T>;
    })
    .catch(err => {
      jsonCache.delete(url);
      throw err;
    });
  jsonCache.set(url, p);
  if (jsonCache.size > 80) jsonCache.clear();
  return p;
}

function splitList(s: string): string[] {
  return s ? s.split('|').filter(Boolean) : [];
}

function itemBrief(row: Row): PoemBrief {
  return {
    id: row[0],
    title: row[1],
    author: row[2],
    dynasty: row[3],
    coll: row[4],
    collName: row[5],
    rhythm: row[6],
    tags: splitList(row[7]),
    lead: row[14] || '',
    len: row[8],
    lines: row[9],
    pop: row[10],
    aid: row[12],
  };
}

function poetBrief(row: PoetRow): PoetBrief {
  return {
    id: row.id,
    name: row.name,
    dynasty: row.dynasty,
    poemCount: row.poemCount,
    charCount: row.charCount,
    collections: row.collections,
    brief: row.brief,
  };
}

function parseTopChars(s: string): { c: string; n: number }[] {
  if (!s) return [];
  const out: { c: string; n: number }[] = [];
  for (const part of s.split('|')) {
    const i = part.lastIndexOf(':');
    if (i <= 0) continue;
    const ch = part.slice(0, i);
    const n = Number(part.slice(i + 1));
    if (ch && Number.isFinite(n)) out.push({ c: ch, n });
  }
  return out;
}

function pushMap(map: Map<string, number[]>, key: string, value: number) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

async function loadIndex(): Promise<IndexData> {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    const meta = await getJson<any>('poem-index.json');
    let rows: Row[];
    if (Array.isArray(meta)) {
      rows = meta;
    } else if (meta && Array.isArray(meta.parts)) {
      const parts = await Promise.all(meta.parts.map((p: any) => getJson<Row[]>(p.file)));
      rows = parts.flat();
    } else {
      throw new Error('诗库索引格式错误');
    }
    const [idOrder] = await Promise.all([getJson<number[]>('id-order.json')]);
    const scores = new Array<number>(rows.length);
    const byAuthor = new Map<string, number[]>();
    const byRhythm = new Map<string, number[]>();
    const byColl = new Map<string, number[]>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      scores[i] = (r[11] ? 3.2 : 0) + Math.min(r[10], 10) * 0.22 + Math.min(r[8], 200) * 0.004;
      pushMap(byAuthor, r[12], i);
      if (r[6]) pushMap(byRhythm, r[6], i);
      pushMap(byColl, r[4], i);
    }
    return { rows, idOrder, scores, byAuthor, byRhythm, byColl };
  })().catch(err => {
    indexPromise = null;
    throw err;
  });
  return indexPromise;
}

async function loadPoetIndex(): Promise<PoetRow[]> {
  if (poetPromise) return poetPromise;
  poetPromise = getJson<any[]>('poet-index.json').then(raw => raw.map(r => ({
    id: r[0], name: r[1], dynasty: r[2], poemCount: r[3], charCount: r[4],
    collections: splitList(r[5]), brief: r[6] || '', topChars: parseTopChars(r[7] || ''),
  }))).catch(err => {
    poetPromise = null;
    throw err;
  });
  return poetPromise;
}

function findIdx(data: IndexData, id: string): number {
  let lo = 0;
  let hi = data.idOrder.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const row = data.rows[data.idOrder[mid]];
    if (row[0] === id) return data.idOrder[mid];
    if (row[0] < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

function loadShard(no: number): Promise<any[]> {
  const hit = shardCache.get(no);
  if (hit) return hit;
  const name = `${String(no).padStart(4, '0')}.json`;
  const p = getJson<any[]>(`poems/${name}`).catch(err => {
    shardCache.delete(no);
    throw err;
  });
  shardCache.set(no, p);
  if (shardCache.size > 24) shardCache.clear();
  return p;
}

async function loadContent(row: Row): Promise<any | null> {
  try {
    const shard = await loadShard(row[13]);
    return shard.find(r => r[0] === row[0]) || null;
  } catch {
    return null;
  }
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(text: string, q: string): string {
  if (!q) return escapeHtml(text);
  const i = text.indexOf(q);
  if (i < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0, i)) + '<mark>' + escapeHtml(q) + '</mark>' + escapeHtml(text.slice(i + q.length));
}

function snippetOf(content: string, q: string, radius = 20): string {
  const flat = String(content || '').replace(/\n/g, ' ');
  const i = flat.indexOf(q);
  if (i < 0) return highlight(flat.slice(0, 48), q);
  const start = Math.max(0, i - radius);
  const end = Math.min(flat.length, i + q.length + radius);
  const core = flat.slice(start, end);
  return (start > 0 ? '…' : '') + highlight(core, q) + (end < flat.length ? '…' : '');
}

function matches(row: Row, params: Record<string, any>): boolean {
  const coll = params.coll && params.coll !== 'all' ? String(params.coll).split(',').filter(Boolean) : null;
  const dyn = params.dyn ? String(params.dyn).split(',') : null;
  if (coll && coll.length && !coll.includes(row[4])) return false;
  if (dyn && dyn.length && !dyn.includes(row[3])) return false;
  if (params.tag && !splitList(row[7]).includes(String(params.tag))) return false;
  if (params.rhythm && row[6] !== String(params.rhythm)) return false;
  if (params.author && row[2] !== String(params.author)) return false;
  const minLen = Number(params.minLen || 0);
  const maxLen = Number(params.maxLen || 0);
  if (minLen && row[8] < minLen) return false;
  if (maxLen && row[8] > maxLen) return false;
  return true;
}

function filterKey(params: Record<string, any>, sort: string): string {
  return [sort, params.coll || '', params.dyn || '', params.tag || '', params.rhythm || '',
    params.author || '', params.minLen || 0, params.maxLen || 0].join('|');
}

function filtered(data: IndexData, params: Record<string, any>): number[] {
  const sort = String(params.sort || 'curated');
  const key = filterKey(params, sort);
  const hit = filterCache.get(key);
  if (hit) return hit;
  const out: number[] = [];
  for (let i = 0; i < data.rows.length; i++) {
    if (matches(data.rows[i], params)) out.push(i);
  }
  if (sort === 'curated') out.sort((a, b) => data.scores[b] - data.scores[a] || a - b);
  else if (sort === 'hot') out.sort((a, b) => data.rows[b][10] - data.rows[a][10] || a - b);
  else if (sort === 'long') out.sort((a, b) => data.rows[b][8] - data.rows[a][8] || a - b);
  else if (sort === 'short') out.sort((a, b) => data.rows[a][8] - data.rows[b][8] || a - b);
  else if (sort === 'chrono') out.sort((a, b) => a - b);
  if (filterCache.size > 10) filterCache.clear();
  filterCache.set(key, out);
  return out;
}

async function bodyCandidates(q: string): Promise<number[]> {
  const key = q.trim();
  if (!key) return [];
  const hit = candidateCache.get(key);
  if (hit) return hit;

  const p = (async () => {
    // 本地开发服务器有 /api/search-candidates；纯静态构建（Pages / EdgeOne）
    // 不要探测它，否则 SPA 回退会把 index.html 当成 JSON 解析。
    if (import.meta.env.DEV) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2500);
        const r = await fetch(`${API_ROOT}/search-candidates?q=${encodeURIComponent(key)}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        });
        clearTimeout(timer);
        if (r.ok) {
          const d = await r.json();
          return Array.isArray(d?.ids)
            ? d.ids.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x) && x >= 0)
            : [];
        }
      } catch {
        // 开发服务器不可用时继续使用静态索引。
      }
    }
    return staticCandidates(key);
  })();

  candidateCache.set(key, p);
  if (candidateCache.size > 40) candidateCache.clear();
  return p;
}

// ---- 静态 Range 检索索引 (GitHub Pages / EdgeOne 等纯静态托管) ----
type RangeEntry = [string, number, number];
type RangeChunk = { file: string; start: number; bytes: number };
type RangeManifest = {
  chunkBytes: number;
  totalBytes: number;
  count: number;
  chunks: RangeChunk[];
};

let rangeMapPromise: Promise<Map<string, [number, number]>> | null = null;
let rangeManifestPromise: Promise<RangeManifest | null> | null = null;
const rangePostingCache = new Map<string, Promise<number[]>>();
const fullRangePromises = new Map<string, Promise<Uint8Array>>();

function loadRangeMap(): Promise<Map<string, [number, number]>> {
  if (rangeMapPromise) return rangeMapPromise;
  rangeMapPromise = getJson<RangeEntry[]>('token-offsets.json')
    .then(rows => {
      const map = new Map<string, [number, number]>();
      for (const [token, off, len] of rows) map.set(token, [off, len]);
      return map;
    })
    .catch(err => {
      rangeMapPromise = null;
      throw err;
    });
  return rangeMapPromise;
}

/**
 * EdgeOne has a 25 MiB per-file limit, so the build can split the binary
 * index into token-aligned chunks and publish a small manifest. GitHub Pages
 * keeps its single token-index.bin, where this manifest is absent and we
 * transparently fall back to the old path.
 */
function loadRangeManifest(): Promise<RangeManifest | null> {
  if (rangeManifestPromise) return rangeManifestPromise;
  rangeManifestPromise = getJson<RangeManifest>('token-index.json')
    .then(meta => (meta && Array.isArray(meta.chunks) && meta.chunks.length ? meta : null))
    .catch(() => null);
  return rangeManifestPromise;
}

function findRangeChunk(meta: RangeManifest, off: number): RangeChunk | null {
  let lo = 0;
  let hi = meta.chunks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cur = meta.chunks[mid];
    if (off < cur.start) hi = mid - 1;
    else if (off >= cur.start + cur.bytes) lo = mid + 1;
    else return cur;
  }
  return null;
}

function fullRange(url: string): Promise<Uint8Array> {
  let p = fullRangePromises.get(url);
  if (!p) {
    p = fetch(url, { cache: 'default' })
      .then(r => {
        if (!r.ok) throw new Error(`range ${r.status}`);
        return r.arrayBuffer();
      })
      .then(b => new Uint8Array(b))
      .catch(err => {
        fullRangePromises.delete(url);
        throw err;
      });
    fullRangePromises.set(url, p);
  }
  return p;
}

function decodeVarints(buf: Uint8Array, start: number, length: number): number[] {
  const out: number[] = [];
  let id = 0;
  let value = 0;
  let shift = 0;
  let first = true;
  const end = start + length;
  for (let i = start; i < end; i++) {
    const b = buf[i];
    value += (b & 0x7f) << shift;
    if (b & 0x80) {
      shift += 7;
      continue;
    }
    if (first) {
      id = value;
      first = false;
    } else {
      id += value;
    }
    out.push(id);
    value = 0;
    shift = 0;
  }
  return out;
}

async function readPostings(token: string, off: number, len: number): Promise<number[]> {
  const cacheKey = `${token}:${off}:${len}`;
  const hit = rangePostingCache.get(cacheKey);
  if (hit) return hit;
  const p = (async () => {
    const manifest = await loadRangeManifest();
    const chunk = manifest ? findRangeChunk(manifest, off) : null;
    const url = chunk ? `${ROOT}/${chunk.file}` : `${ROOT}/token-index.bin`;
    const localOff = chunk ? off - chunk.start : off;
    const r = await fetch(url, {
      headers: { Range: `bytes=${localOff}-${localOff + len - 1}` },
      cache: 'default',
    });
    if (r.status === 206) {
      const buf = new Uint8Array(await r.arrayBuffer());
      return decodeVarints(buf, 0, buf.byteLength);
    }
    if (r.ok) {
      // 某些静态服务器忽略 Range，回退到一次性下载当前分片后切片。
      const full = await fullRange(url);
      return decodeVarints(full, localOff, len);
    }
    throw new Error(`range ${r.status}`);
  })().catch(err => {
    rangePostingCache.delete(cacheKey);
    throw err;
  });
  rangePostingCache.set(cacheKey, p);
  return p;
}

function cjkChars(q: string): string[] {
  return [...q.normalize('NFC')].filter(ch => /\p{Script=Han}/u.test(ch));
}

function intersectIds(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push(a[i]); i++; j++; }
    else if (a[i] < b[j]) i++;
    else j++;
  }
  return out;
}

async function staticCandidates(q: string): Promise<number[]> {
  const chars = cjkChars(q);
  if (!chars.length) return [];
  const map = await loadRangeMap();

  let tokens = chars.length === 1
    ? ['c:' + chars[0]]
    : chars.slice(0, -1).map((ch, i) => 'b:' + ch + chars[i + 1]);

  const read = (list: string[]) => Promise.all(list.map(t => {
    const meta = map.get(t);
    if (!meta) return Promise.resolve<number[] | null>(null);
    return readPostings(t, meta[0], meta[1]);
  }));

  let lists = await read(tokens);
  if (tokens[0]?.startsWith('b:') && lists.some(x => x === null)) {
    // 缺一个二元组时只丢弃该项，保留其余相邻二元组。
    // 完整短语必然包含其余已存在的二元组，所以这是精确结果的超集；
    // 后续搜索页会按页对正文做完整子串校验。
    const keep = tokens.map((t, i) => [t, lists[i]] as const)
      .filter(([, list]) => list !== null);
    if (keep.length) {
      tokens = keep.map(([t]) => t);
      lists = keep.map(([, list]) => list as number[]);
    } else {
      // 连一个二元组都没有的极短/极生僻查询，才退回单字。
      tokens = chars.map(ch => 'c:' + ch);
      lists = await read(tokens);
    }
  }
  if (lists.some(x => x === null)) return [];
  let ids = lists[0] as number[];
  for (let i = 1; i < lists.length; i++) ids = intersectIds(ids, lists[i] as number[]);
  return ids;
}

function searchKey(q: string, params: Record<string, any>): string {
  return [q, params.coll || '', params.dyn || '', params.tag || '', params.rhythm || '',
    params.author || '', params.minLen || 0, params.maxLen || 0].join('|');
}

async function candidateNeedsExact(q: string): Promise<boolean> {
  const chars = cjkChars(q);
  if (chars.length <= 1) return false;
  if (chars.length === 2) {
    const map = await loadRangeMap();
    return !map.has('b:' + chars.join(''));
  }
  return true;
}

async function getSearchState(q: string, params: Record<string, any>): Promise<SearchState> {
  const key = searchKey(q, params);
  const cached = searchStateCache.get(key);
  if (cached) return cached;

  const data = await loadIndex();
  const seen = new Set<number>();
  const hits: Hit[] = [];
  const qLower = q.toLowerCase();
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    if (!matches(row, params)) continue;
    let score = 0;
    let where = '';
    if (row[1].includes(q) || (qLower !== q && row[1].toLowerCase().includes(qLower))) { score += 70; where = 'title'; }
    if (row[2].includes(q)) score += 55;
    if (row[6] && row[6].includes(q)) { score += 45; if (!where) where = 'rhythm'; }
    if (row[7] && row[7].includes(q)) score += 10;
    if (score === 0) continue;
    score += Math.min(row[10], 10) * 14 + (row[11] ? 120 : 0) + Math.min(row[8], 120) * 0.05;
    hits.push({ idx: i, score, where: where || 'content' });
    seen.add(i);
  }

  const candidates = await bodyCandidates(q);
  const order: { idx: number; score: number }[] = [];
  for (const i of candidates) {
    if (seen.has(i) || i < 0 || i >= data.rows.length) continue;
    const row = data.rows[i];
    if (!matches(row, params)) continue;
    seen.add(i);
    order.push({
      idx: i,
      score: 30 + Math.min(row[10], 10) * 14 + (row[11] ? 120 : 0) + Math.min(row[8], 120) * 0.05,
    });
  }
  order.sort((a, b) => b.score - a.score || a.idx - b.idx);

  const state: SearchState = {
    hits,
    order,
    cursor: 0,
    done: order.length === 0,
    needsExact: await candidateNeedsExact(q),
  };

  // 单字/已命中的二元组本身就是精确匹配，不需要逐篇读正文。
  if (!state.needsExact) {
    for (const item of order) state.hits.push({ idx: item.idx, score: item.score, where: 'content' });
    state.cursor = order.length;
    state.done = true;
  }

  if (searchStateCache.size > 12) searchStateCache.clear();
  searchStateCache.set(key, state);
  return state;
}

async function ensureSearchHits(state: SearchState, q: string, target: number): Promise<void> {
  if (!state.needsExact || state.hits.length >= target || state.done) return;
  const data = await loadIndex();
  const phrase = cjkChars(q).join('');
  const batch = 16;

  while (state.hits.length < target && state.cursor < state.order.length) {
    const slice = state.order.slice(state.cursor, state.cursor + batch);
    const recs = await Promise.all(slice.map(item => loadContent(data.rows[item.idx])));
    for (let i = 0; i < slice.length; i++) {
      const rec = recs[i];
      if (rec && String(rec[8] || '').includes(phrase)) {
        state.hits.push({ idx: slice[i].idx, score: slice[i].score, where: 'content' });
      }
    }
    state.cursor += slice.length;
  }
  if (state.cursor >= state.order.length) state.done = true;
}

async function hydrateSnippets(items: Hit[], q: string): Promise<(string | undefined)[]> {
  const shards = new Set<number>();
  const data = await loadIndex();
  for (const it of items) shards.add(data.rows[it.idx][13]);
  const maps = new Map<number, Map<string, any>>();
  await Promise.all([...shards].map(async no => {
    try {
      const rows = await loadShard(no);
      maps.set(no, new Map(rows.map(r => [r[0], r])));
    } catch {
      // 单个分片失败时仍返回其他结果
    }
  }));
  return items.map(it => {
    const row = data.rows[it.idx];
    const rec = maps.get(row[13])?.get(row[0]);
    return rec ? snippetOf(rec[8], q) : undefined;
  });
}

async function searchPoems(q: string, params: Record<string, any>) {
  const page = Math.max(1, Number(params.page) || 1);
  const size = Math.min(60, Math.max(4, Number(params.size) || 12));
  const state = await getSearchState(q, params);
  await ensureSearchHits(state, q, page * size);
  state.hits.sort((a, b) => b.score - a.score || a.idx - b.idx);

  const total = state.hits.length;
  const hasMore = !state.done;
  const pageHits = state.hits.slice((page - 1) * size, page * size);
  const data = await loadIndex();
  const snippets = await hydrateSnippets(pageHits, q);
  return {
    total, page, size, q, hasMore,
    items: pageHits.map((h, i) => ({
      ...itemBrief(data.rows[h.idx]),
      snippet: snippets[i],
      where: h.where,
    })),
  };
}

async function listPoems(params: Record<string, any>) {
  const page = Math.max(1, Number(params.page) || 1);
  const size = Math.min(60, Math.max(6, Number(params.size) || 24));
  const q = String(params.q || '').trim();
  if (q) return searchPoems(q, params);

  const data = await loadIndex();
  if (String(params.sort) === 'random') {
    const base = filtered(data, { ...params, sort: 'chrono' });
    const total = base.length;
    const items: PoemBrief[] = [];
    const count = Math.min(size, total);
    for (let i = 0; i < count; i++) items.push(itemBrief(data.rows[base[Math.floor(Math.random() * base.length)]]));
    return { total, page, size, items };
  }

  const list = filtered(data, params);
  return {
    total: list.length, page, size,
    items: list.slice((page - 1) * size, page * size).map(i => itemBrief(data.rows[i])),
  };
}

async function poemDetail(id: string): Promise<PoemDetail | null> {
  const data = await loadIndex();
  const idx = findIdx(data, id);
  if (idx < 0) return null;
  const row = data.rows[idx];
  const rec = await loadContent(row);
  if (!rec) return null;
  const content: string = rec[8] || '';
  const linesArr = content.split('\n');
  const tags = splitList(row[7]);
  let authorInfo: PoemDetail['authorInfo'] = null;
  try {
    const poets = await loadPoetIndex();
    const a = poets.find(x => x.id === row[12]);
    if (a) authorInfo = { id: a.id, name: a.name, dynasty: a.dynasty, bio: a.brief, poemCount: a.poemCount };
  } catch {}
  const sameAuthor = (data.byAuthor.get(row[12]) || [])
    .filter(i => data.rows[i][0] !== id)
    .sort((a, b) => data.rows[b][10] - data.rows[a][10])
    .slice(0, 7).map(i => itemBrief(data.rows[i]));
  const sameRhythm = row[6]
    ? (data.byRhythm.get(row[6]) || []).filter(i => data.rows[i][0] !== id)
        .sort((a, b) => data.rows[b][10] - data.rows[a][10]).slice(0, 6).map(i => itemBrief(data.rows[i]))
    : [];
  const collList = data.byColl.get(row[4]) || [];
  const pos = collList.indexOf(idx);
  const prev = pos > 0 ? itemBrief(data.rows[collList[pos - 1]]) : null;
  const next = pos >= 0 && pos < collList.length - 1 ? itemBrief(data.rows[collList[pos + 1]]) : null;
  return {
    ...itemBrief(row),
    linesArr,
    notes: Array.isArray(rec[9]) ? rec[9] : [],
    prologue: rec[10] || '',
    authorInfo,
    sameAuthor,
    sameRhythm,
    prev,
    next,
    tags,
  };
}

async function listPoets(params: Record<string, any>) {
  const page = Math.max(1, Number(params.page) || 1);
  const size = Math.min(60, Math.max(1, Number(params.size) || 30));
  const list = await loadPoetIndex();
  let out = list.filter(a => a.poemCount > 0);
  if (params.dyn) {
    const dyn = new Set(String(params.dyn).split(','));
    out = out.filter(a => dyn.has(a.dynasty));
  }
  if (params.q) out = out.filter(a => a.name.includes(String(params.q)));
  if (String(params.sort) === 'name') out.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  else out.sort((a, b) => b.poemCount - a.poemCount || a.name.localeCompare(b.name, 'zh'));
  return {
    total: out.length, page, size,
    items: out.slice((page - 1) * size, page * size).map(poetBrief),
  };
}

async function poetDetail(id: string): Promise<any | null> {
  const poets = await loadPoetIndex();
  const a = poets.find(x => x.id === id);
  if (!a) return null;
  const data = await loadIndex();
  const works = (data.byAuthor.get(id) || [])
    .slice()
    .sort((x, y) => data.rows[y][11] - data.rows[x][11] || data.rows[y][10] - data.rows[x][10]);
  let bio = a.brief;
  let shortBio = a.brief;
  try {
    const m = id.match(/^a-(\d+)/);
    const group = m ? Math.floor(Number(m[1]) / 1000).toString().padStart(4, '0') : 'x';
    const bios = await getJson<Record<string, { bio: string; shortBio: string }>>(`poet-bio/${group}.json`);
    if (bios[id]) { bio = bios[id].bio || bio; shortBio = bios[id].shortBio || shortBio; }
  } catch {}
  return {
    ...poetBrief(a), bio, shortBio,
    works: works.slice(0, 40).map(i => itemBrief(data.rows[i])),
    total: works.length,
    topChars: a.topChars,
  };
}

async function dynamicLines(ch: string, page: number, size: number) {
  const data = await loadIndex();
  const candidates = await bodyCandidates(ch);
  if (!candidates.length) return { char: ch, total: 0, page, size, items: [] };
  const top = candidates
    .filter(i => i >= 0 && i < data.rows.length)
    .sort((a, b) => data.rows[b][11] - data.rows[a][11] || data.rows[b][10] - data.rows[a][10])
    .slice(0, 36);
  const seen = new Set<string>();
  const entries: { line: string; id: string; title: string; author: string; dynasty: string; coll: string; pop: number; anth: number }[] = [];
  for (const idx of top) {
    const row = data.rows[idx];
    const rec = await loadContent(row);
    if (!rec) continue;
    const content: string = rec[8] || '';
    for (const line of content.split('\n')) {
      if (line.includes(ch) && !seen.has(line)) {
        seen.add(line);
        entries.push({ line, id: row[0], title: row[1], author: row[2], dynasty: row[3], coll: row[4], pop: row[10], anth: row[11] });
        break;
      }
    }
  }
  entries.sort((a, b) => b.anth - a.anth || b.pop - a.pop);
  const picked: any[] = [];
  const perAuthor = new Map<string, number>();
  for (const e of entries) {
    if (picked.length >= 240) break;
    const n = perAuthor.get(e.author) || 0;
    if (n >= 2) continue;
    perAuthor.set(e.author, n + 1);
    const { pop, anth, ...rest } = e;
    picked.push(rest);
  }
  return { char: ch, total: entries.length, page, size, items: picked.slice((page - 1) * size, page * size) };
}

async function flyLines(params: Record<string, any>) {
  const ch = String(params.char || '').trim();
  const page = Math.max(1, Number(params.page) || 1);
  const size = Math.min(40, Math.max(4, Number(params.size) || 20));
  if (!ch || ch.length > 2) return { char: ch, total: 0, page, size, items: [] };
  let all: { total: number; items: any[] } | null = null;
  try {
    all = await getJson<{ total: number; items: any[] }>(`lines/${encodeURIComponent(ch)}.json`);
  } catch {}
  if (all) {
    return { char: ch, total: all.items.length, corpusTotal: all.total, page, size, items: all.items.slice((page - 1) * size, page * size) };
  }
  // 少见的字：用检索候选回查少量正文，现取飞花令。
  return dynamicLines(ch, page, size);
}

async function dailyPoem(date: string) {
  const [stats, daily] = await Promise.all([
    getJson<Stats>('stats.json'),
    getJson<any[]>('daily.json'),
  ]);
  const pool = stats.dailyPool || [];
  if (!pool.length || !daily.length) return null;
  const h = hashStr(date) % pool.length;
  const it = daily[h] || daily.find((x: any) => x[0] === pool[h]);
  if (!it) return null;
  return {
    id: it[0], title: it[1], author: it[2], dynasty: it[3], collName: it[4], rhythm: it[5],
    linesArr: it[6], tags: splitList(it[7]), pop: it[8],
    coll: '', aid: '', len: (it[6] || []).join('').length, lines: (it[6] || []).length,
    lead: '', sameAuthor: [], sameRhythm: [], prev: null, next: null, notes: [], prologue: '',
  };
}

async function randomPoem(coll?: string) {
  const ids = await getJson<string[]>('random.json');
  if (!ids.length) return { id: '' };
  if (!coll) {
    const i = Math.floor(Math.random() * ids.length);
    return { id: ids[i] };
  }
  const data = await loadIndex();
  const pool = data.byColl.get(coll) || [];
  if (!pool.length) return { id: '' };
  return { id: data.rows[pool[Math.floor(Math.random() * pool.length)]][0] };
}

async function getClassics() {
  const data = await getJson<any>('classics.json');
  return {
    books: (data.books || []).map((b: any) => ({
      id: b.id, title: b.title, author: b.author, intro: b.intro,
      sections: (b.sections || []).length, items: (b.items || []).length,
    })),
  };
}

async function getClassic(id: string): Promise<ClassicBook | null> {
  const data = await getJson<any>('classics.json');
  return (data.books || []).find((b: any) => b.id === id) || null;
}

function qs(params?: Record<string, any>): string {
  if (!params) return '';
  return '?' + Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function route(path: string, params: Record<string, any>): Promise<any> {
  if (path === '/stats' || path === '/meta') {
    const stats = await getJson<Stats>('stats.json');
    return { ...stats, generatedAt: new Date().toISOString() };
  }
  if (path === '/daily') return dailyPoem(params.date || new Date().toISOString().slice(0, 10));
  if (path === '/poems') return listPoems(params);
  if (path === '/search') {
    const q = String(params.q || '').trim();
    if (!q) return { total: 0, items: [], q };
    return searchPoems(q, params);
  }
  if (path === '/poem/random') return randomPoem(params.coll ? String(params.coll) : undefined);
  if (path.startsWith('/poem/')) return poemDetail(decodeURIComponent(path.slice(6)));
  if (path === '/poets') return listPoets(params);
  if (path.startsWith('/poet/')) return poetDetail(decodeURIComponent(path.slice(6)));
  if (path === '/lines') return flyLines(params);
  if (path === '/classics') return getClassics();
  if (path.startsWith('/classics/')) return getClassic(decodeURIComponent(path.slice(10)));
  if (path === '/s2t') return getJson('s2t.json');
  throw new Error(`未知接口 ${path}`);
}

export async function api<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  const url = path + qs(params);
  const hit = apiCache.get(url);
  if (hit) return hit as Promise<T>;
  const p = route(path, params || {}).catch(err => {
    apiCache.delete(url);
    throw err;
  });
  apiCache.set(url, p);
  if (apiCache.size > 240) apiCache.clear();
  return p as Promise<T>;
}

export const apiUrl = (path: string) => `${ROOT}${path}`;
