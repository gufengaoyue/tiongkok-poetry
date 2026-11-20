import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApi, useDebounce } from '../hooks';
import { useLang } from '../lang';
import type { PoemBrief, Stats } from '../types';
import { PoemCard } from '../components/PoemCard';
import { Icon } from '../components/Icon';

const PAGE_SIZE = 24;

const SORTS = [
  { v: 'curated', l: '精选推荐' },
  { v: 'hot', l: '网络热度' },
  { v: 'long', l: '篇幅最长' },
  { v: 'short', l: '篇幅最短' },
  { v: 'chrono', l: '收录顺序' },
  { v: 'random', l: '随机漫游' },
];

export function Library() {
  const [sp, setSp] = useSearchParams();
  const { data: stats } = useApi<Stats>('/stats');
  const { tr } = useLang();

  const coll = sp.get('coll') || 'all';
  const dyn = sp.get('dyn') || '';
  const tag = sp.get('tag') || '';
  const author = sp.get('author') || '';
  const sort = sp.get('sort') || 'curated';
  const qParam = sp.get('q') || '';

  const [q, setQ] = useState(qParam);
  const dq = useDebounce(q, 320);
  const [items, setItems] = useState<PoemBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const epoch = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(qParam); }, [qParam]);

  useEffect(() => {
    if (dq === qParam) return;
    const next = new URLSearchParams(sp);
    if (dq) next.set('q', dq); else next.delete('q');
    setSp(next, { replace: true });
  }, [dq]);

  const key = `${coll}|${dyn}|${tag}|${author}|${sort}|${qParam}`;

  useEffect(() => {
    const e = ++epoch.current;
    setItems([]);
    setTotal(0);
    setLoading(true);
    api<any>('/poems', {
      coll: coll === 'all' ? undefined : coll,
      dyn: dyn || undefined,
      tag: tag || undefined,
      author: author || undefined,
      q: qParam || undefined,
      sort, page: 1, size: PAGE_SIZE,
    }).then(r => {
      if (e !== epoch.current) return;
      setItems(r.items);
      setTotal(r.total);
      setLoading(false);
    }).catch(() => { if (e === epoch.current) setLoading(false); });
  }, [key]);

  const loadMore = () => {
    if (loading || sort === 'random') return;
    const e = epoch.current;
    const nextPage = Math.floor(items.length / PAGE_SIZE) + 1;
    setLoading(true);
    api<any>('/poems', {
      coll: coll === 'all' ? undefined : coll,
      dyn: dyn || undefined,
      tag: tag || undefined,
      author: author || undefined,
      q: qParam || undefined,
      sort, page: nextPage, size: PAGE_SIZE,
    }).then(r => {
      if (e !== epoch.current) return;
      setItems(prev => [...prev, ...r.items]);
      setTotal(r.total);
      setLoading(false);
    }).catch(() => { if (e === epoch.current) setLoading(false); });
  };

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(es => {
      es.forEach(en => {
        if (en.isIntersecting && !loading && items.length < total && sort !== 'random') {
          io.disconnect();
          loadMore();
        }
      });
    }, { rootMargin: '500px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, items.length, total, sort, key]);

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v); else next.delete(k);
    setSp(next);
  };

  const collChips = useMemo(() => {
    if (!stats) return [];
    return [{ code: 'all', name: '全部', count: stats.totals.poems }, ...stats.collections];
  }, [stats]);

  const activeColl = stats?.collections.find(c => c.code === coll);

  return (
    <main className="page">
      <div className="shell" style={{ paddingTop: 84 }}>
        <div className="kicker"><span className="dot" />THE LIBRARY · 诗库</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 30, flexWrap: 'wrap' }}>
          <div>
            <h1 className="search-title" style={{ marginTop: 20 }}>
              {activeColl ? tr(activeColl.name) : '全部诗词'}
            </h1>
            <p className="lede">
              {activeColl ? activeColl.desc : '从《诗经》到纳兰词，按总集、朝代与关键词，进入这座三十四万五千首诗的库房。'}
            </p>
          </div>
          <div className="sec-side" style={{ paddingBottom: 8 }}>
            {activeColl ? `${activeColl.era} · ${activeColl.dynasty}` : '12 COLLECTIONS'}
          </div>
        </div>

        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="filter-bar">
            {collChips.map(c => (
              <button key={c.code}
                className={`chip ${coll === c.code ? 'active' : ''}`}
                onClick={() => setParam('coll', c.code === 'all' ? null : c.code)}>
                {tr(c.name)}<span className="n">{c.count.toLocaleString('en-US')}</span>
              </button>
            ))}
          </div>
          <div className="filter-bar">
            <button className={`chip ${!dyn ? 'active' : ''}`} onClick={() => setParam('dyn', null)}>所有朝代</button>
            {stats?.dynasties.map(d => (
              <button key={d.name} className={`chip ${dyn === d.name ? 'active' : ''}`}
                onClick={() => setParam('dyn', d.name)}>
                {d.name}<span className="n">{d.count.toLocaleString('en-US')}</span>
              </button>
            ))}
            {tag && (
              <button className="chip active" onClick={() => setParam('tag', null)}>
                {tr(tag)} ✕
              </button>
            )}
            {author && (
              <button className="chip active" onClick={() => setParam('author', null)}>
                {tr(author)} ✕
              </button>
            )}
          </div>
        </div>

        <div className="lib-toolbar" style={{ marginTop: 28 }}>
          <div style={{ position: 'relative', maxWidth: 360, width: '100%' }}>
            <input className="input" value={q} placeholder="在诗题、诗人或诗句中检索…"
              onChange={e => setQ(e.target.value)}
              style={{ paddingLeft: 40 }} />
            <span style={{ position: 'absolute', left: 16, top: 13, color: 'var(--text-3)' }}>{Icon.search({})}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="lib-count">共 <b>{total.toLocaleString('en-US')}</b> 首</span>
            <select className="select" value={sort} onChange={e => setParam('sort', e.target.value)}>
              {SORTS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
        </div>

        {items.length > 0 ? (
          <>
            <div className="lib-grid" style={{ marginTop: 8 }}>
              {items.map((p, i) => <PoemCard key={p.id} poem={p} delay={Math.min(i, 12) * 26} />)}
            </div>
            <div ref={sentinel} className="sentinel" />
            {loading && (
              <div className="load-more"><div className="spin-loader" /></div>
            )}
            {!loading && items.length >= total && total > 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0 10px', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em' }}>
                — 已抵达卷末 · END OF SCROLL —
              </div>
            )}
          </>
        ) : loading ? (
          <div className="lib-grid" style={{ marginTop: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 250 }} />
            ))}
          </div>
        ) : (
          <div className="empty">
            没有找到符合条件的诗句
            <div style={{ marginTop: 20 }}>
              <button className="btn ghost small" onClick={() => setSp(new URLSearchParams())}>清除全部筛选</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
