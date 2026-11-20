export interface CollectionMeta {
  code: string;
  name: string;
  short: string;
  dynasty: string;
  era: string;
  desc: string;
  count: number;
  index: number;
  samples?: { id: string; title: string; author: string }[];
}

export interface PoetBrief {
  id: string;
  name: string;
  dynasty: string;
  poemCount: number;
  charCount: number;
  collections: string[];
  bio?: string;
  shortBio?: string;
  brief?: string;
}

export interface PoemBrief {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  coll: string;
  collName: string;
  rhythm: string;
  tags: string[];
  lead: string;
  len: number;
  lines: number;
  pop: number;
  aid: string;
  snippet?: string;
  where?: string;
}

export interface PoemDetail extends PoemBrief {
  linesArr: string[];
  notes: string[];
  prologue: string;
  authorInfo: { id: string; name: string; dynasty: string; bio: string; poemCount: number } | null;
  sameAuthor: PoemBrief[];
  sameRhythm: PoemBrief[];
  prev: PoemBrief | null;
  next: PoemBrief | null;
}

export interface Stats {
  totals: {
    poems: number; authors: number; lines: number; chars: number;
    collections: number; dynasties: number; rhythms: number; tags: number;
  };
  collections: CollectionMeta[];
  dynasties: { name: string; count: number; era: string; authors: number; sample: string[] }[];
  topAuthors: PoetBrief[];
  topRhythms: { name: string; count: number }[];
  chars: { c: string; n: number }[];
  imagery: { name: string; count: number }[];
  lengthDist: { label: string; count: number }[];
  authorDist: { label: string; count: number }[];
  quotes: { text: string; author: string; title: string; id: string }[];
  tags: { name: string; count: number }[];
  rhythms: { name: string; count: number }[];
  dailyPool: string[];
}

export interface ClassicBook {
  id: string; title: string; author: string; intro: string;
  sections: { title: string; paragraphs: string[] }[];
  items?: { text: string; comments: string[] }[];
}

export interface LineItem {
  line: string; id: string; title: string; author: string; dynasty: string; coll: string;
}

export interface PoetDetail extends PoetBrief {
  works: PoemBrief[];
  total: number;
  topChars: { c: string; n: number }[];
}
