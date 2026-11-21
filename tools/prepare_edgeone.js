#!/usr/bin/env node
/**
 * Prepare the EdgeOne Pages upload folder.
 *
 * EdgeOne limits a single uploaded file to 25 MiB. The browser range index is
 * about 31 MiB, so split it into token-aligned chunks and leave a small
 * token-index.json manifest next to token-offsets.json. Token boundaries are
 * used as split points so one Range request never crosses two chunks.
 *
 * This script only touches web/dist-edgeone. GitHub Pages keeps using its own
 * dist-pages build and the single token-index.bin.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'web', 'dist-edgeone');
const DATA = path.join(DIST, 'data');
const MAX_CHUNK = 16 * 1024 * 1024;

function fail(message) {
  console.error(`[edgeone] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  fail('web/dist-edgeone/index.html 不存在，请先运行 npm run edgeone:build');
}

const indexPath = path.join(DATA, 'token-index.bin');
const offsetsPath = path.join(DATA, 'token-offsets.json');
if (!fs.existsSync(indexPath) || !fs.existsSync(offsetsPath)) {
  fail('缺少 data/token-index.bin 或 data/token-offsets.json');
}

const raw = fs.readFileSync(indexPath);
const offsets = JSON.parse(fs.readFileSync(offsetsPath, 'utf8'));

if (raw.length > MAX_CHUNK * 64) {
  fail(`索引体积异常：${raw.length} 字节`);
}

const chunks = [];
let chunkStart = 0;
for (const row of offsets) {
  const off = row[1];
  const len = row[2];
  if (!Number.isInteger(off) || !Number.isInteger(len) || off < 0 || len < 0) {
    fail(`token-offsets.json 中存在非法偏移：${JSON.stringify(row)}`);
  }
  if (off < chunkStart) {
    fail(`token-offsets.json 偏移未按顺序排列：${off} < ${chunkStart}`);
  }
  const end = off + len;
  if (end - chunkStart > MAX_CHUNK) {
    if (off === chunkStart) {
      fail(`单个 token 的 posting 超过 16 MiB，无法按 token 边界分片：${row[0]}`);
    }
    chunks.push({ start: chunkStart, end: off });
    chunkStart = off;
  }
  if (end - chunkStart > MAX_CHUNK) {
    fail(`拆分后单个 token 仍超过 16 MiB：${row[0]}`);
  }
}
if (chunkStart < raw.length) chunks.push({ start: chunkStart, end: raw.length });
if (!chunks.length) fail('索引为空，无法生成 EdgeOne 分片');

// Remove chunks left by an earlier build before writing the new set.
for (const name of fs.readdirSync(DATA)) {
  if (/^token-index-\d{3}\.bin$/.test(name)) fs.unlinkSync(path.join(DATA, name));
}

const manifestChunks = chunks.map((chunk, index) => {
  const file = `token-index-${String(index).padStart(3, '0')}.bin`;
  fs.writeFileSync(path.join(DATA, file), raw.subarray(chunk.start, chunk.end));
  return { file, start: chunk.start, bytes: chunk.end - chunk.start };
});

const rangeManifest = {
  chunkBytes: MAX_CHUNK,
  totalBytes: raw.length,
  count: manifestChunks.length,
  chunks: manifestChunks,
};
fs.writeFileSync(
  path.join(DATA, 'token-index.json'),
  JSON.stringify(rangeManifest, null, 2),
  'utf8',
);

// EdgeOne resolves static files first; only unmatched routes fall back to index.
fs.copyFileSync(path.join(ROOT, 'deploy', 'edgeone.json'), path.join(DIST, 'edgeone.json'));
for (const stale of ['404.html', '.nojekyll']) {
  const p = path.join(DIST, stale);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
fs.unlinkSync(indexPath);

const siteManifestPath = path.join(DATA, 'manifest.json');
if (fs.existsSync(siteManifestPath)) {
  const siteManifest = JSON.parse(fs.readFileSync(siteManifestPath, 'utf8'));
  siteManifest.rangeIndexBytes = raw.length;
  siteManifest.rangeIndexChunks = manifestChunks.length;
  siteManifest.rangeIndexChunkBytes = MAX_CHUNK;
  fs.writeFileSync(
    siteManifestPath,
    JSON.stringify(siteManifest, null, 2),
    'utf8',
  );
}

const total = manifestChunks.reduce((sum, c) => sum + c.bytes, 0);
console.log(
  `[edgeone] ${manifestChunks.length} 个索引分片，` +
  `${(total / 1024 / 1024).toFixed(1)} MiB；已删除单文件 token-index.bin`
);
