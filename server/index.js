/**
 * 墨澜 · MOLAN — 诗词数据服务
 * 纯 Node.js 内置模块，无第三方依赖。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');

const DATA_DIR = path.join(__dirname, 'data');
const DIST_DIR = path.join(__dirname, '..', 'web', 'dist');
const PORT = Number(process.env.PORT || 5177);
const HOST = process.env.HOST || '127.0.0.1';

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

/* ------------------------------------------------------------------ 载入数据 */

const statsRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'stats.json'), 'utf8'));
const authorsRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'authors.json'), 'utf8'));
const classicsRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'classics.json'), 'utf8'));

const shardFiles = fs.readdirSync(DATA_DIR).filter(f => /^poems-\d{2}\.tsv$/.test(f)).sort();
const lines = [];
if (shardFiles.length) {
  log(`读取语料 ${shardFiles.length} 个分片 ...`);
  for (const file of shardFiles) {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    for (const line of raw.split('\n')) if (line) lines.push(line);
  }
} else {
  log('读取语料 poems.tsv ...');
  const raw = fs.readFileSync(path.join(DATA_DIR, 'poems.tsv'), 'utf8');
  for (const line of raw.split('\n')) if (line) lines.push(line);
}

const poems = [];
const poemById = new Map();
const byColl = {};
const collMeta = {};
const authorMap = new Map();      // "name|dynasty" -> author
const authorWorks = new Map();    // author id -> [poem idx]
const allIdx = [];

statsRaw.collections.forEach((c, i) => {
  c.index = i;
  collMeta[c.code] = c;
  byColl[c.code] = [];
});

for (let line of lines) {
  if (!line) continue;
  const f = line.split('\x1f');
  if (f.length < 12) continue;
  const [id, coll, dyn, author, title, content, tags, rhythm, sub, notes, pro, pop] = f;
  const p = {
    idx: poems.length,
    id, coll, dyn, author, title,
    c: content.replace(/\x02/g, '\n'),
    tags: tags ? tags.split('\x03') : [],
    rhythm: rhythm || '',
    sub: sub || '',
    notes: notes ? notes.split('\x02') : [],
    pro: pro || '',
    pop: Number(pop) || 0,
    len: content.length - (content.match(/\n/g) || []).length,
    lc: (content.match(/\n/g) || []).length + 1,
    ci: collMeta[coll] ? collMeta[coll].index : 0,
    anth: tags.includes('唐诗三百首') || tags.includes('宋词三百首'),
  };
  poems.push(p);
  poemById.set(id, p);
  allIdx.push(p.idx);
  if (byColl[coll]) byColl[coll].push(p.idx);
}

log(`载入 ${poems.length} 首`);

// 诗人索引
for (const a of authorsRaw) {
  a.poemCount = 0; // 由语料重新统计，避免与档案自带数值重复累加
  authorMap.set(`${a.name}|${a.dynasty}`, a);
  authorWorks.set(a.id, []);
}
for (const p of poems) {
  let a = authorMap.get(`${p.author}|${p.dyn}`);
  if (!a) {
    a = { id: `x-${encodeURIComponent(p.author)}`, name: p.author, dynasty: p.dyn, poemCount: 0,
          charCount: 0, collections: [], bio: '', shortBio: '' };
    authorMap.set(`${p.author}|${p.dyn}`, a);
    authorWorks.set(a.id, []);
  }
  a.poemCount = (a.poemCount || 0) + 1;
  p.aid = a.id;
  authorWorks.get(a.id).push(p.idx);
}

const authors = authorsRaw.map(a => ({ ...a, works: authorWorks.get(a.id) || [] }));
// 统计口径与诗人列表对齐：只计入确有作品的诗人
statsRaw.totals.authors = authors.filter(a => a.poemCount > 0).length;

// 预排序
const curatedRank = allIdx.slice().sort((i, j) => {
  const a = poems[i], b = poems[j];
  const sa = (a.anth ? 3.2 : 0) + a.pop * 0.22 + Math.min(a.len, 200) * 0.004;
  const sb = (b.anth ? 3.2 : 0) + b.pop * 0.22 + Math.min(b.len, 200) * 0.004;
  return sb - sa || a.idx - b.idx;
});
const hotRank = allIdx.slice().sort((i, j) => poems[j].pop - poems[i].pop || poems[i].idx - poems[j].idx);
const longRank = allIdx.slice().sort((i, j) => poems[j].len - poems[i].len);
const shortRank = allIdx.slice().sort((i, j) => poems[i].len - poems[j].len);

const SORTS = { curated: curatedRank, hot: hotRank, long: longRank, short: shortRank, chrono: allIdx };

/* ------------------------------------------------------------------ 工具 */

function sendJson(res, obj, status = 200, cache = 'no-store') {
  const body = JSON.stringify(obj);
  const accept = res.req.headers['accept-encoding'] || '';
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache,
  };
  if (/\bgzip\b/.test(accept) && body.length > 1024) {
    const buf = zlib.gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    res.writeHead(status, headers);
    res.end(buf);
  } else {
    res.writeHead(status, headers);
    res.end(body);
  }
}

function itemBrief(p) {
  const first = p.c.split('\n');
  return {
    id: p.id, title: p.title, author: p.author, dynasty: p.dyn, coll: p.coll,
    collName: collMeta[p.coll] ? collMeta[p.coll].name : p.coll,
    rhythm: p.rhythm, tags: p.tags, lead: first.slice(0, 2).join('\n').slice(0, 64),
    len: p.len, lines: p.lc, pop: p.pop, aid: p.aid,
  };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(text, q) {
  if (!q) return esc(text);
  const i = text.indexOf(q);
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(q) + '</mark>' + esc(text.slice(i + q.length));
}

function snippetOf(p, q, radius = 20) {
  const flat = p.c.replace(/\n/g, ' ');
  const i = flat.indexOf(q);
  if (i < 0) return highlight(flat.slice(0, 48), q);
  const start = Math.max(0, i - radius);
  const end = Math.min(flat.length, i + q.length + radius);
  const core = flat.slice(start, end);
  return (start > 0 ? '…' : '') + highlight(core, q) + (end < flat.length ? '…' : '');
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ------------------------------------------------------------------ 查询 */

function filterBase(params) {
  let base = SORTS[params.sort] || SORTS.curated;
  let colls = null;
  if (params.coll) {
    colls = new Set(params.coll.split(',').filter(Boolean));
    if (colls.size === 1) {
      const only = [...colls][0];
      if (only === 'all' || !byColl[only]) colls = null;
    }
  }
  const dyn = params.dyn ? new Set(params.dyn.split(',')) : null;
  const tag = params.tag || '';
  const rhythm = params.rhythm || '';
  const author = params.author || '';
  const q = (params.q || '').trim();
  const minLen = Number(params.minLen || 0);
  const maxLen = Number(params.maxLen || 0);

  const out = [];
  let total = 0;
  for (let k = 0; k < base.length; k++) {
    const p = poems[base[k]];
    if (colls && !colls.has(p.coll)) continue;
    if (dyn && !dyn.has(p.dyn)) continue;
    if (tag && !p.tags.includes(tag)) continue;
    if (rhythm && p.rhythm !== rhythm) continue;
    if (author && p.author !== author) continue;
    if (minLen && p.len < minLen) continue;
    if (maxLen && p.len > maxLen) continue;
    total++;
    out.push(p.idx);
  }
  return { list: out, total };
}

const searchCache = new Map();

function searchPoems(q, params) {
  const key = `${q}|${params.coll || ''}|${params.dyn || ''}|${params.tag || ''}`;
  if (searchCache.has(key)) return searchCache.get(key);
  const colls = params.coll && params.coll !== 'all' ? new Set(params.coll.split(',')) : null;
  const dyn = params.dyn ? new Set(params.dyn.split(',')) : null;
  const tag = params.tag || '';
  const hits = [];
  for (const p of poems) {
    if (colls && !colls.has(p.coll)) continue;
    if (dyn && !dyn.has(p.dyn)) continue;
    if (tag && !p.tags.includes(tag)) continue;
    let score = 0;
    let where = '';
    if (p.title.includes(q)) { score += 70; where = 'title'; }
    if (p.author.includes(q)) score += 55;
    if (p.rhythm && p.rhythm.includes(q)) { score += 45; if (!where) where = 'rhythm'; }
    if (p.c.includes(q)) { score += 30; if (!where) where = 'content'; }
    if (p.tags.some(t => t.includes(q))) score += 10;
    if (score === 0) continue;
    score += Math.min(p.pop, 10) * 14 + (p.anth ? 120 : 0) + Math.min(p.len, 120) * 0.05;
    hits.push({ p, score, where: where || 'content' });
  }
  hits.sort((a, b) => b.score - a.score || a.p.idx - b.p.idx);
  const result = hits;
  if (searchCache.size > 40) searchCache.clear();
  searchCache.set(key, result);
  return result;
}

/* ------------------------------------------------------------------ 路由 */

function listPoems(params) {
  const page = Math.max(1, Number(params.page) || 1);
  const size = Math.min(60, Math.max(6, Number(params.size) || 24));
  let list, total;
  if (params.q && params.q.trim()) {
    const hits = searchPoems(params.q.trim(), params);
    total = hits.length;
    list = hits.slice((page - 1) * size, page * size).map(h => h.p.idx);
    return {
      total, page, size,
      items: list.map(i => {
        const p = poems[i];
        const h = hits.find(x => x.p.idx === i);
        return { ...itemBrief(p), snippet: snippetOf(p, params.q.trim()), where: h ? h.where : 'content' };
      }),
    };
  }
  if (params.sort === 'random') {
    const { list: baseList } = filterBase({ ...params, sort: 'chrono' });
    total = baseList.length;
    const picked = [];
    for (let i = 0; i < Math.min(size, total); i++) {
      picked.push(baseList[Math.floor(Math.random() * baseList.length)]);
    }
    return { total, page, size, items: picked.map(i => itemBrief(poems[i])) };
  }
  const res = filterBase(params);
  total = res.total;
  list = res.list.slice((page - 1) * size, page * size);
  return { total, page, size, items: list.map(i => itemBrief(poems[i])) };
}

function poemDetail(id) {
  const p = poemById.get(id);
  if (!p) return null;
  const author = authorMap.get(`${p.author}|${p.dyn}`) || null;
  const linesArr = p.c.split('\n');
  const sameAuthor = (authorWorks.get(p.aid) || []).filter(i => poems[i].id !== id)
    .sort((a, b) => poems[b].pop - poems[a].pop).slice(0, 7).map(i => itemBrief(poems[i]));
  const sameRhythm = p.rhythm
    ? allIdx.filter(i => poems[i].rhythm === p.rhythm && poems[i].id !== id)
        .sort((a, b) => poems[b].pop - poems[a].pop).slice(0, 6).map(i => itemBrief(poems[i]))
    : [];
  const sameColl = byColl[p.coll];
  const pos = sameColl.indexOf(p.idx);
  const prev = pos > 0 ? itemBrief(poems[sameColl[pos - 1]]) : null;
  const next = pos >= 0 && pos < sameColl.length - 1 ? itemBrief(poems[sameColl[pos + 1]]) : null;
  return {
    ...itemBrief(p), linesArr, notes: p.notes, prologue: p.pro,
    authorInfo: author ? { id: author.id, name: author.name, dynasty: author.dynasty,
      bio: author.shortBio || '', poemCount: author.poemCount } : null,
    sameAuthor, sameRhythm, prev, next,
  };
}

const lineCache = new Map();

function flyLines(ch) {
  if (lineCache.has(ch)) return lineCache.get(ch);
  const pool = [];
  const seen = new Set();
  let total = 0;
  for (const p of poems) {
    if (!p.c.includes(ch)) continue;
    let line = '';
    for (const ln of p.c.split('\n')) {
      if (ln.includes(ch)) { line = ln; break; }
    }
    if (!line || seen.has(line)) continue;
    seen.add(line);
    total++;
    pool.push({ line, id: p.id, title: p.title, author: p.author, dynasty: p.dyn,
      coll: p.coll, pop: p.pop || 0, anth: p.anth ? 1 : 0 });
  }
  // 名篇优先，其次热度；同一作者最多两条，避免整页都是一个人
  pool.sort((a, b) => b.anth - a.anth || b.pop - a.pop);
  const picked = [];
  const perAuthor = new Map();
  for (const it of pool) {
    if (picked.length >= 240) break;
    const n = perAuthor.get(it.author) || 0;
    if (n >= 2) continue;
    perAuthor.set(it.author, n + 1);
    const { pop, anth, ...rest } = it;
    picked.push(rest);
  }
  const result = { total, items: picked };
  if (lineCache.size >= 16) lineCache.clear();
  lineCache.set(ch, result);
  return result;
}

function dailyPoem(dateStr) {
  const pool = statsRaw.dailyPool && statsRaw.dailyPool.length ? statsRaw.dailyPool : allIdx.map(i => poems[i].id);
  const h = hashStr(dateStr || '') % pool.length;
  const p = poemById.get(pool[h]);
  return p ? { ...itemBrief(p), linesArr: p.c.split('\n') } : null;
}

/* 简繁转换表（按需加载） */
let s2tData = null;
function getS2T() {
  if (!s2tData) s2tData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 's2t.json'), 'utf8'));
  return s2tData;
}

/* ------------------------------------------------------------------ HTTP */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

const staticCache = new Map();

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const filePath = path.join(DIST_DIR, rel);
  if (!filePath.startsWith(DIST_DIR)) return false;
  let st;
  try { st = fs.statSync(filePath); } catch { return false; }
  if (!st.isFile()) return false;

  const ext = path.extname(filePath);
  const isText = ['.html', '.js', '.css', '.json', '.svg', '.txt'].includes(ext);
  const etag = `W/"${st.size}-${st.mtimeMs}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return true;
  }
  const accept = req.headers['accept-encoding'] || '';
  const key = filePath + '|' + etag;
  let entry = staticCache.get(key);
  if (!entry) {
    const buf = fs.readFileSync(filePath);
    entry = { buf, gz: null };
    if (isText && buf.length > 1024) entry.gz = zlib.gzipSync(buf);
    if (staticCache.size > 120) staticCache.clear();
    staticCache.set(key, entry);
  }
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'ETag': etag,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
  };
  if (entry.gz && /\bgzip\b/.test(accept)) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    res.writeHead(200, headers);
    res.end(entry.gz);
  } else {
    res.writeHead(200, headers);
    res.end(entry.buf);
  }
  return true;
}

const server = http.createServer((req, res) => {
  res.req = req;
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = u.pathname;
  const qp = Object.fromEntries(u.searchParams.entries());

  try {
    if (p.startsWith('/api/')) {
      const route = p.slice(4);
      if (route === '/stats' || route === '/meta') {
        return sendJson(res, { ...statsRaw, generatedAt: new Date().toISOString() }, 200, 'public, max-age=60');
      }
      if (route === '/poems') return sendJson(res, listPoems(qp));
      if (route === '/poem/random') {
        const pool = qp.coll && byColl[qp.coll] ? byColl[qp.coll] : allIdx;
        const p2 = poems[pool[Math.floor(Math.random() * pool.length)]];
        return sendJson(res, { id: p2.id });
      }
      if (route.startsWith('/poem/')) {
        const d = poemDetail(decodeURIComponent(route.slice(6)));
        return d ? sendJson(res, d) : sendJson(res, { error: 'not_found' }, 404);
      }
      if (route === '/poets') {
        const page = Math.max(1, Number(qp.page) || 1);
        const size = Math.min(60, Math.max(1, Number(qp.size) || 30));
        let list = authors.filter(a => a.poemCount > 0);
        if (qp.dyn) { const s = new Set(qp.dyn.split(',')); list = list.filter(a => s.has(a.dynasty)); }
        if (qp.q) list = list.filter(a => a.name.includes(qp.q));
        if (qp.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        else list.sort((a, b) => b.poemCount - a.poemCount);
        const total = list.length;
        return sendJson(res, {
          total, page, size,
          items: list.slice((page - 1) * size, page * size).map(a => ({
            id: a.id, name: a.name, dynasty: a.dynasty, poemCount: a.poemCount,
            charCount: a.charCount, collections: a.collections, brief: (a.shortBio || '').slice(0, 64),
          })),
        });
      }
      if (route.startsWith('/poet/')) {
        const id = decodeURIComponent(route.slice(6));
        const a = authors.find(x => x.id === id);
        if (!a) return sendJson(res, { error: 'not_found' }, 404);
        const works = (authorWorks.get(id) || []).map(i => poems[i]);
        works.sort((x, y) => (y.anth ? 1 : 0) - (x.anth ? 1 : 0) || y.pop - x.pop);
        const chars = {};
        for (const w of works) for (const ch of w.c) if (/[\u4e00-\u9fff]/.test(ch)) chars[ch] = (chars[ch] || 0) + 1;
        const topChars = Object.entries(chars).sort((a2, b2) => b2[1] - a2[1]).slice(0, 24)
          .map(([c, n]) => ({ c, n }));
        return sendJson(res, {
          ...a, bio: a.bio || '', shortBio: a.shortBio || '',
          works: works.slice(0, 40).map(itemBrief), total: works.length, topChars,
        });
      }
      if (route === '/search') {
        const q = (qp.q || '').trim();
        if (!q) return sendJson(res, { total: 0, items: [], q });
        const r = listPoems({ ...qp, q, size: qp.size || 12 });
        return sendJson(res, { ...r, q });
      }
      if (route === '/lines') {
        const ch = (qp.char || '').trim();
        if (!ch || ch.length > 2) return sendJson(res, { total: 0, items: [] });
        const all = flyLines(ch);
        const page = Math.max(1, Number(qp.page) || 1);
        const size = Math.min(40, Math.max(4, Number(qp.size) || 20));
        return sendJson(res, { char: ch, total: all.total, page, size,
          items: all.items.slice((page - 1) * size, page * size) });
      }
      if (route === '/daily') {
        const d = qp.date || new Date().toISOString().slice(0, 10);
        const poem = dailyPoem(d);
        return poem ? sendJson(res, poem) : sendJson(res, { error: 'not_found' }, 404);
      }
      if (route === '/classics') {
        return sendJson(res, { books: classicsRaw.books.map(b => ({
          id: b.id, title: b.title, author: b.author, intro: b.intro,
          sections: (b.sections || []).length, items: (b.items || []).length,
        })) });
      }
      if (route.startsWith('/classics/')) {
        const b = classicsRaw.books.find(x => x.id === decodeURIComponent(route.slice(10)));
        return b ? sendJson(res, b) : sendJson(res, { error: 'not_found' }, 404);
      }
      if (route === '/s2t') {
        return sendJson(res, getS2T(), 200, 'public, max-age=86400');
      }
      return sendJson(res, { error: 'not_found' }, 404);
    }

    if (req.method === 'GET' && serveStatic(req, res, p)) return;
    // SPA 回退
    const index = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(index)) {
      const buf = fs.readFileSync(index);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(zlib.gzipSync(buf));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('页面尚未构建：请先运行 npm run build');
  } catch (err) {
    console.error(err);
    sendJson(res, { error: String(err && err.message || err) }, 500);
  }
});

server.listen(PORT, HOST, () => {
  log(`墨澜服务已启动：http://${HOST}:${PORT}`);
  log(`语料 ${poems.length} 首 · 诗人 ${authors.length} 位 · 词牌 ${statsRaw.topRhythms.length}+`);
});
