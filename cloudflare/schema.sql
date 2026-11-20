-- 墨澜 · Cloudflare D1 schema
-- 由 tools/build_cloudflare_seed.py 生成的种子配合使用。

DROP TABLE IF EXISTS poems_fts;
DROP TABLE IF EXISTS poems;
DROP TABLE IF EXISTS authors;
DROP TABLE IF EXISTS lines;
DROP TABLE IF EXISTS line_stats;

CREATE TABLE poems (
  rid INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,
  coll TEXT NOT NULL,
  dynasty TEXT NOT NULL,
  author TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  rhythm TEXT NOT NULL DEFAULT '',
  sub TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '[]',
  prologue TEXT NOT NULL DEFAULT '',
  popularity REAL NOT NULL DEFAULT 0,
  len INTEGER NOT NULL DEFAULT 0,
  lines INTEGER NOT NULL DEFAULT 1,
  anth INTEGER NOT NULL DEFAULT 0,
  aid TEXT NOT NULL
);

CREATE INDEX idx_poems_coll ON poems(coll);
CREATE INDEX idx_poems_dyn ON poems(dynasty);
CREATE INDEX idx_poems_author ON poems(author);
CREATE INDEX idx_poems_rhythm ON poems(rhythm);
CREATE INDEX idx_poems_aid ON poems(aid);
CREATE INDEX idx_poems_len ON poems(len);
CREATE INDEX idx_poems_hot ON poems(popularity DESC);
CREATE INDEX idx_poems_curated ON poems(anth DESC, popularity DESC);

CREATE TABLE authors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dynasty TEXT NOT NULL,
  poem_count INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  collections TEXT NOT NULL DEFAULT '[]',
  bio TEXT NOT NULL DEFAULT '',
  short_bio TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_authors_count ON authors(poem_count DESC);
CREATE INDEX idx_authors_dyn ON authors(dynasty);

CREATE TABLE lines (
  ch TEXT NOT NULL,
  rank INTEGER NOT NULL,
  line TEXT NOT NULL,
  poem_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  dynasty TEXT NOT NULL,
  coll TEXT NOT NULL,
  PRIMARY KEY (ch, rank)
);

CREATE TABLE line_stats (
  ch TEXT PRIMARY KEY,
  total INTEGER NOT NULL
);

-- 中文按“单字 + 空格”建索引，查询时用 FTS5 phrase（"明 月"）匹配连续字。
CREATE VIRTUAL TABLE poems_fts USING fts5(
  pid UNINDEXED,
  title,
  author,
  body,
  tags,
  rhythm
);
