/**
 * 墨澜 · Cloudflare Worker
 * 静态前端由 Workers Static Assets 托管，/api/* 由 D1 提供。
 * 数据来源：cloudflare/schema.sql + tools/build_cloudflare_seed.py 生成的种子。
 */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const jsonCache = new Map();

function sendJson(data, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, 'Cache-Control': cache },
  });
}

function paramsOf(url) {
  return Object.fromEntries(url.searchParams.entries());
}

async function assetJson(env, request, path) {
  if (jsonCache.has(path)) return jsonCache.get(path);
  const promise = (async () => {
    const res = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
    if (!res.ok) throw new Error(`asset ${path} returned ${res.status}`);
    return res.json();
  })();
  jsonCache.set(path, promise);
  try {
    return await promise;
  } catch (err) {
    jsonCache.delete(path);
    throw err;
  }
}

function parseTags(value) {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function collName(stats, code) {
  const item = (stats.collections || []).find(c => c.code === code);
  return item ? item.name : code;
}

function brief(row, stats) {
  const content = row.content || '';
  const first = content.split('\n');
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    dynasty: row.dynasty,
    coll: row.coll,
    collName: collName(stats, row.coll),
    rhythm: row.rhythm || '',
    tags: parseTags(row.tags),
    lead: first.slice(0, 2).join('\n').slice(0, 64),
    len: Number(row.len) || 0,
    lines: Number(row.lines) || 1,
    pop: Number(row.popularity) || 0,
    aid: row.aid || '',
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function snippetOf(content, q, radius = 20) {
  const flat = String(content || '').replace(/\n/g, ' ');
  const i = flat.indexOf(q);
  if (i < 0) return escapeHtml(flat.slice(0, 48));
  const start = Math.max(0, i - radius);
  const end = Math.min(flat.length, i + q.length + radius);
  return (start > 0 ? '…' : '') + escapeHtml(flat.slice(start, i)) +
    '<mark>' + escapeHtml(q) + '</mark>' + escapeHtml(flat.slice(i + q.length, end)) +
    (end < flat.length ? '…' : '');
}

/** 把查询拆成单字并用 FTS5 phrase 连接，解决中文无空格分词问题 */
function ftsQuery(q) {
  const chars = [...String(q || '').normalize('NFC')].filter(ch => /[\p{Script=Han}A-Za-z0-9]/u.test(ch));
  if (!chars.length) return null;
  return '"' + chars.join(' ') + '"';
}

function hashStr(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ 列表 */

async function listPoems(env, stats, sp) {
  const page = Math.max(1, Number(sp.page) || 1);
  const size = Math.min(60, Math.max(6, Number(sp.size) || 24));
  const q = (sp.q || '').trim();

  if (q) return searchPoems(env, stats, sp, q, page, size);

  const where = [];
  const binds = [];
  if (sp.coll && sp.coll !== 'all') {
    const codes = sp.coll.split(',').filter(Boolean);
    if (codes.length) {
      where.push(`coll IN (${codes.map(() => '?').join(',')})`);
      binds.push(...codes);
    }
  }
  if (sp.dyn) {
    const dyns = sp.dyn.split(',').filter(Boolean);
    if (dyns.length) {
      where.push(`dynasty IN (${dyns.map(() => '?').join(',')})`);
      binds.push(...dyns);
    }
  }
  if (sp.tag) {
    where.push('instr(tags, ?) > 0');
    binds.push(`"${sp.tag}"`);
  }
  if (sp.rhythm) { where.push('rhythm = ?'); binds.push(sp.rhythm); }
  if (sp.author) { where.push('author = ?'); binds.push(sp.author); }
  if (sp.minLen) { where.push('len >= ?'); binds.push(Number(sp.minLen)); }
  if (sp.maxLen) { where.push('len <= ?'); binds.push(Number(sp.maxLen)); }

  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const order = ({
    curated: 'anth DESC, popularity DESC, len DESC, rid ASC',
    hot: 'popularity DESC, rid ASC',
    long: 'len DESC, popularity DESC, rid ASC',
    short: 'len ASC, popularity DESC, rid ASC',
    chrono: 'rid ASC',
    random: 'RANDOM()',
  })[sp.sort] || 'anth DESC, popularity DESC, len DESC, rid ASC';

  const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM poems${whereSql}`).bind(...binds).first();
  const total = Number(count?.n || 0);
  const rows = await env.DB.prepare(
    `SELECT id,title,author,dynasty,coll,rhythm,tags,content,len,lines,popularity,aid,anth
     FROM poems${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`
  ).bind(...binds, size, (page - 1) * size).all();

  return {
    total, page, size,
    items: (rows.results || []).map(row => brief(row, stats)),
  };
}

async function searchPoems(env, stats, sp, q, page, size) {
  const match = ftsQuery(q);
  if (!match) return { total: 0, page, size, items: [], q, where: '' };

  const extra = [];
  const binds = [match];
  if (sp.coll && sp.coll !== 'all') {
    const codes = sp.coll.split(',').filter(Boolean);
    if (codes.length) {
      extra.push(`p.coll IN (${codes.map(() => '?').join(',')})`);
      binds.push(...codes);
    }
  }
  if (sp.dyn) {
    const dyns = sp.dyn.split(',').filter(Boolean);
    if (dyns.length) {
      extra.push(`p.dynasty IN (${dyns.map(() => '?').join(',')})`);
      binds.push(...dyns);
    }
  }
  if (sp.tag) { extra.push('instr(p.tags, ?) > 0'); binds.push(`"${sp.tag}"`); }
  const extraSql = extra.length ? ' AND ' + extra.join(' AND ') : '';

  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM poems_fts JOIN poems p ON p.id = poems_fts.pid
     WHERE poems_fts MATCH ?${extraSql}`
  ).bind(...binds).first();
  const total = Number(count?.n || 0);

  const rows = await env.DB.prepare(
    `SELECT p.id,p.title,p.author,p.dynasty,p.coll,p.rhythm,p.tags,p.content,
            p.len,p.lines,p.popularity,p.aid,p.anth
     FROM poems_fts JOIN poems p ON p.id = poems_fts.pid
     WHERE poems_fts MATCH ?${extraSql}
     ORDER BY bm25(poems_fts, 10.0, 8.0, 1.0, 3.0, 3.0)
              - p.anth * 150.0 - p.popularity * 6.0, p.rid ASC
     LIMIT ? OFFSET ?`
  ).bind(...binds, size, (page - 1) * size).all();

  const items = (rows.results || []).map(row => {
    let where = 'content';
    if (row.title.includes(q)) where = 'title';
    else if (row.author.includes(q)) where = 'author';
    else if ((row.rhythm || '').includes(q)) where = 'rhythm';
    return {
      ...brief(row, stats),
      snippet: snippetOf(row.content, q),
      where,
    };
  });
  return { total, page, size, items, q };
}

/* ------------------------------------------------------------------ 详情 */

async function poemDetail(env, stats, id) {
  const row = await env.DB.prepare(
    `SELECT id,title,author,dynasty,coll,rhythm,tags,content,notes,prologue,
            len,lines,popularity,aid,anth,rid
     FROM poems WHERE id = ?`
  ).bind(id).first();
  if (!row) return null;

  const author = await env.DB.prepare(
    `SELECT id,name,dynasty,short_bio,poem_count FROM authors WHERE id = ?`
  ).bind(row.aid).first();

  const [sameAuthor, sameRhythm, prev, next] = await Promise.all([
    env.DB.prepare(
      `SELECT id,title,author,dynasty,coll,rhythm,tags,content,len,lines,popularity,aid,anth
       FROM poems WHERE aid = ? AND id <> ? ORDER BY anth DESC, popularity DESC LIMIT 7`
    ).bind(row.aid, row.id).all(),
    row.rhythm ? env.DB.prepare(
      `SELECT id,title,author,dynasty,coll,rhythm,tags,content,len,lines,popularity,aid,anth
       FROM poems WHERE rhythm = ? AND id <> ? ORDER BY popularity DESC LIMIT 6`
    ).bind(row.rhythm, row.id).all() : Promise.resolve({ results: [] }),
    env.DB.prepare(
      `SELECT id,title,author,dynasty,coll,rhythm,tags,content,len,lines,popularity,aid,anth
       FROM poems WHERE coll = ? AND rid < ? ORDER BY rid DESC LIMIT 1`
    ).bind(row.coll, row.rid).all(),
    env.DB.prepare(
      `SELECT id,title,author,dynasty,coll,rhythm,tags,content,len,lines,popularity,aid,anth
       FROM poems WHERE coll = ? AND rid > ? ORDER BY rid ASC LIMIT 1`
    ).bind(row.coll, row.rid).all(),
  ]);

  return {
    ...brief(row, stats),
    linesArr: String(row.content || '').split('\n'),
    notes: parseTags(row.notes),
    prologue: row.prologue || '',
    authorInfo: author ? {
      id: author.id, name: author.name, dynasty: author.dynasty,
      bio: author.short_bio || '', poemCount: Number(author.poem_count) || 0,
    } : null,
    sameAuthor: (sameAuthor.results || []).map(x => brief(x, stats)),
    sameRhythm: (sameRhythm.results || []).map(x => brief(x, stats)),
    prev: prev.results?.[0] ? brief(prev.results[0], stats) : null,
    next: next.results?.[0] ? brief(next.results[0], stats) : null,
  };
}

/* ------------------------------------------------------------------ 诗人 */

async function listPoets(env, sp) {
  const page = Math.max(1, Number(sp.page) || 1);
  const size = Math.min(60, Math.max(1, Number(sp.size) || 30));
  const where = ['poem_count > 0'];
  const binds = [];
  if (sp.dyn) {
    const dyns = sp.dyn.split(',').filter(Boolean);
    if (dyns.length) {
      where.push(`dynasty IN (${dyns.map(() => '?').join(',')})`);
      binds.push(...dyns);
    }
  }
  if (sp.q) { where.push('instr(name, ?) > 0'); binds.push(sp.q); }
  const whereSql = ' WHERE ' + where.join(' AND ');
  const order = sp.sort === 'name' ? 'name ASC' : 'poem_count DESC, name ASC';

  const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM authors${whereSql}`).bind(...binds).first();
  const total = Number(count?.n || 0);
  const rows = await env.DB.prepare(
    `SELECT id,name,dynasty,poem_count,char_count,collections,short_bio
     FROM authors${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`
  ).bind(...binds, size, (page - 1) * size).all();

  return {
    total, page, size,
    items: (rows.results || []).map(a => ({
      id: a.id, name: a.name, dynasty: a.dynasty,
      poemCount: Number(a.poem_count) || 0,
      charCount: Number(a.char_count) || 0,
      collections: parseTags(a.collections),
      brief: String(a.short_bio || '').slice(0, 64),
    })),
  };
}

async function poetDetail(env, stats, id) {
  const a = await env.DB.prepare(
    `SELECT id,name,dynasty,poem_count,char_count,collections,bio,short_bio FROM authors WHERE id = ?`
  ).bind(id).first();
  if (!a) return null;

  const works = await env.DB.prepare(
    `SELECT id,title,author,dynasty,coll,rhythm,tags,content,len,lines,popularity,aid,anth
     FROM poems WHERE aid = ? ORDER BY anth DESC, popularity DESC, rid ASC LIMIT 40`
  ).bind(id).all();
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM poems WHERE aid = ?').bind(id).first();
  const contents = await env.DB.prepare('SELECT content FROM poems WHERE aid = ?').bind(id).all();

  const chars = new Map();
  for (const row of contents.results || []) {
    for (const ch of row.content || '') {
      if (/[\u4e00-\u9fff]/.test(ch)) chars.set(ch, (chars.get(ch) || 0) + 1);
    }
  }
  const topChars = [...chars.entries()]
    .sort((x, y) => y[1] - x[1]).slice(0, 24)
    .map(([c, n]) => ({ c, n }));

  return {
    id: a.id, name: a.name, dynasty: a.dynasty,
    poemCount: Number(a.poem_count) || 0,
    charCount: Number(a.char_count) || 0,
    collections: parseTags(a.collections),
    bio: a.bio || '', shortBio: a.short_bio || '',
    works: (works.results || []).map(x => brief(x, stats)),
    total: Number(count?.n || 0),
    topChars,
  };
}

/* ------------------------------------------------------------------ 其他 */

async function flyLines(env, sp) {
  const ch = (sp.char || '').trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const size = Math.min(40, Math.max(4, Number(sp.size) || 20));
  if (!ch || ch.length > 2) return { char: ch, total: 0, page, size, items: [] };

  const totalRow = await env.DB.prepare('SELECT total FROM line_stats WHERE ch = ?').bind(ch).first();
  const seeded = await env.DB.prepare(
    `SELECT line,poem_id AS id,title,author,dynasty,coll
     FROM lines WHERE ch = ? ORDER BY rank LIMIT ? OFFSET ?`
  ).bind(ch, size, (page - 1) * size).all();

  if (seeded.results?.length) {
    return {
      char: ch,
      total: Number(totalRow?.total || seeded.results.length),
      page, size,
      items: seeded.results,
    };
  }

  const rows = await env.DB.prepare(
    `SELECT id,title,author,dynasty,coll,content
     FROM poems WHERE instr(content, ?) > 0
     ORDER BY anth DESC, popularity DESC LIMIT 40`
  ).bind(ch).all();

  const items = [];
  const seen = new Set();
  for (const row of rows.results || []) {
    for (const line of String(row.content || '').split('\n')) {
      if (line.includes(ch) && !seen.has(line)) {
        seen.add(line);
        items.push({ line, id: row.id, title: row.title, author: row.author, dynasty: row.dynasty, coll: row.coll });
        break;
      }
    }
  }
  return { char: ch, total: items.length, page, size, items: items.slice((page - 1) * size, page * size) };
}

async function dailyPoem(env, stats, date) {
  const pool = Array.isArray(stats.dailyPool) && stats.dailyPool.length ? stats.dailyPool : [];
  if (!pool.length) return null;
  const id = pool[hashStr(date) % pool.length];
  const row = await env.DB.prepare(
    `SELECT id,title,author,dynasty,coll,rhythm,tags,content,len,lines,popularity,aid,anth
     FROM poems WHERE id = ?`
  ).bind(id).first();
  return row ? { ...brief(row, stats), linesArr: String(row.content || '').split('\n') } : null;
}

/* ------------------------------------------------------------------ 入口 */

async function handleApi(env, request, url, route, sp) {
  const stats = await assetJson(env, request, '/data/stats.json');

  if (route === 'stats' || route === 'meta') {
    return sendJson({ ...stats, generatedAt: new Date().toISOString() }, 200, 'public, max-age=60');
  }
  if (route === 'poems') return sendJson(await listPoems(env, stats, sp));
  if (route === 'search') {
    const q = (sp.q || '').trim();
    if (!q) return sendJson({ total: 0, items: [], q });
    const page = Math.max(1, Number(sp.page) || 1);
    const size = Math.min(60, Math.max(4, Number(sp.size) || 12));
    return sendJson(await searchPoems(env, stats, sp, q, page, size));
  }
  if (route === 'poem/random') {
    const coll = sp.coll || '';
    if (coll) {
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM poems WHERE coll = ?').bind(coll).first();
      const offset = Math.floor(Math.random() * Number(count?.n || 1));
      const row = await env.DB.prepare('SELECT id FROM poems WHERE coll = ? LIMIT 1 OFFSET ?').bind(coll, offset).first();
      return row ? sendJson({ id: row.id }) : sendJson({ error: 'not_found' }, 404);
    }
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM poems').first();
    const offset = Math.floor(Math.random() * Number(count?.n || 1));
    const row = await env.DB.prepare('SELECT id FROM poems LIMIT 1 OFFSET ?').bind(offset).first();
    return row ? sendJson({ id: row.id }) : sendJson({ error: 'not_found' }, 404);
  }
  if (route.startsWith('poem/')) {
    const detail = await poemDetail(env, stats, decodeURIComponent(route.slice(5)));
    return detail ? sendJson(detail) : sendJson({ error: 'not_found' }, 404);
  }
  if (route === 'poets') return sendJson(await listPoets(env, sp));
  if (route.startsWith('poet/')) {
    const detail = await poetDetail(env, stats, decodeURIComponent(route.slice(5)));
    return detail ? sendJson(detail) : sendJson({ error: 'not_found' }, 404);
  }
  if (route === 'lines') return sendJson(await flyLines(env, sp));
  if (route === 'daily') {
    const d = sp.date || new Date().toISOString().slice(0, 10);
    const poem = await dailyPoem(env, stats, d);
    return poem ? sendJson(poem) : sendJson({ error: 'not_found' }, 404);
  }
  if (route === 'classics') {
    const data = await assetJson(env, request, '/data/classics.json');
    return sendJson({
      books: (data.books || []).map(b => ({
        id: b.id, title: b.title, author: b.author, intro: b.intro,
        sections: (b.sections || []).length, items: (b.items || []).length,
      })),
    });
  }
  if (route.startsWith('classics/')) {
    const data = await assetJson(env, request, '/data/classics.json');
    const id = decodeURIComponent(route.slice(9));
    const book = (data.books || []).find(b => b.id === id);
    return book ? sendJson(book) : sendJson({ error: 'not_found' }, 404);
  }
  if (route === 's2t') {
    const data = await assetJson(env, request, '/data/s2t.json');
    return sendJson(data, 200, 'public, max-age=86400');
  }
  return sendJson({ error: 'not_found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    try {
      const route = url.pathname.slice(5);
      return await handleApi(env, request, url, route, paramsOf(url));
    } catch (err) {
      return sendJson({ error: String(err?.message || err) }, 500);
    }
  },
};
