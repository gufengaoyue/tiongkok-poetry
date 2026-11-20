/**
 * 用本地 SQLite 验证 Cloudflare Worker 的路由与 SQL（D1 兼容层）。
 * 运行：node tools/test_cloudflare_worker.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import worker from '../cloudflare/worker.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(root, 'cloudflare', 'molan.sqlite'));
const dataDir = path.join(root, 'web', 'public');

function prepare(sql) {
  let args = [];
  return {
    bind(...values) { args = values; return this; },
    first() { return db.prepare(sql).get(...args) ?? null; },
    all() { return { results: db.prepare(sql).all(...args) }; },
  };
}

const env = {
  DB: { prepare },
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      const file = path.join(dataDir, url.pathname.replace(/^\//, ''));
      if (fs.existsSync(file)) {
        return new Response(fs.readFileSync(file), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    },
  },
};

async function api(pathname) {
  const res = await worker.fetch(new Request('https://molan.test' + pathname), env);
  const body = await res.json();
  return { status: res.status, body };
}

const cases = [
  ['/api/stats'],
  ['/api/poems?page=1&size=6'],
  ['/api/poems?coll=tang&sort=long&size=4'],
  ['/api/search?q=明月&page=2&size=6'],
  ['/api/search?q=静夜思&size=3'],
  ['/api/poem/tang-08126'],
  ['/api/poets?size=5'],
  ['/api/poet/a-0001'],
  ['/api/lines?char=月&size=9'],
  ['/api/lines?char=江&size=4&page=2'],
  ['/api/daily?date=2026-11-20'],
  ['/api/classics'],
  ['/api/classics/lunyu'],
  ['/api/s2t'],
  ['/api/poem/random?coll=tang'],
];

let failed = 0;
for (const [pathname] of cases) {
  try {
    const { status, body } = await api(pathname);
    const summary = Array.isArray(body.items) ? `items=${body.items.length} total=${body.total}`
      : body.totals ? `poems=${body.totals.poems}`
      : body.title ? `${body.title} / ${body.author}`
      : body.books ? `books=${body.books.length}`
      : body.id ? `id=${body.id}`
      : `keys=${Object.keys(body).slice(0, 4).join(',')}`;
    console.log(status === 200 ? 'OK ' : 'BAD', pathname, status, summary);
    if (status !== 200) {
      failed++;
      console.error('   ', JSON.stringify(body).slice(0, 300));
    }
  } catch (err) {
    failed++;
    console.error('ERR', pathname, err?.stack || err);
  }
}

// 分页和检索细节
const search = await api('/api/search?q=明月&page=2&size=6');
if (search.body.page !== 2 || search.body.items.length !== 6) {
  failed++;
  console.error('search pagination failed', search.body.page, search.body.items.length);
}
const detail = await api('/api/poem/tang-08126');
if (detail.body.title !== '静夜思' || detail.body.linesArr?.length !== 2) {
  failed++;
  console.error('poem detail failed', detail.body.title, detail.body.linesArr?.length);
}
const lines = await api('/api/lines?char=月&size=9');
if (lines.body.total !== 57444 || lines.body.items?.[0]?.author !== '苏轼') {
  failed++;
  console.error('lines failed', lines.body.total, lines.body.items?.[0]?.author);
}

db.close();
console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
