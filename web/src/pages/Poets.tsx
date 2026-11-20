import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApi, useDebounce } from '../hooks';
import { useLang } from '../lang';
import type { PoetBrief, Stats } from '../types';
import { Icon } from '../components/Icon';

const PAGE_SIZE = 30;

/** 档案简介常以人名开头，列表中已有大字姓名，这里去掉重复前缀 */
function briefText(brief: string, name: string): string {
  let s = (brief || '').trim();
  // 列表中已有大字姓名，先去掉重复前缀
  if (name && s.startsWith(name)) s = s.slice(name.length);
  s = s.replace(/^[，,、：:\s　]+/, '');
  // 再去掉紧随其后的生卒年括注（「（一一二五～一二〇九）」「--(1002-1060)」等写法）
  s = s.replace(/^[—\-–\s]*[（(][^）)]*[）)][，,、：:\s　]*/, '');
  s = s.replace(/^[，,、：:\s　]+/, '');
  return s;
}

export function Poets() {
  const { data: stats } = useApi<Stats>('/stats');
  const { tr } = useLang();
  const [sp, setSp] = useSearchParams();
  const dyn = sp.get('dyn') || '';
  const [q, setQ] = useState(sp.get('q') || '');
  const dq = useDebounce(q, 320);
  const [items, setItems] = useState<PoetBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const epoch = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dq === (sp.get('q') || '')) return;
    const next = new URLSearchParams(sp);
    if (dq) next.set('q', dq); else next.delete('q');
    setSp(next, { replace: true });
  }, [dq]);

  const key = `${dyn}|${sp.get('q') || ''}`;

  useEffect(() => {
    const e = ++epoch.current;
    setItems([]); setTotal(0); setLoading(true);
    api<any>('/poets', { dyn: dyn || undefined, q: sp.get('q') || undefined, page: 1, size: PAGE_SIZE })
      .then(r => {
        if (e !== epoch.current) return;
        setItems(r.items); setTotal(r.total); setLoading(false);
      }).catch(() => { if (e === epoch.current) setLoading(false); });
  }, [key]);

  const loadMore = () => {
    if (loading) return;
    const e = epoch.current;
    const nextPage = Math.floor(items.length / PAGE_SIZE) + 1;
    setLoading(true);
    api<any>('/poets', { dyn: dyn || undefined, q: sp.get('q') || undefined, page: nextPage, size: PAGE_SIZE })
      .then(r => {
        if (e !== epoch.current) return;
        setItems(prev => [...prev, ...r.items]); setTotal(r.total); setLoading(false);
      }).catch(() => { if (e === epoch.current) setLoading(false); });
  };

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting && !loading && items.length < total) { io.disconnect(); loadMore(); }
    }), { rootMargin: '500px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, items.length, total, key]);

  const max = Math.max(...items.map(i => i.poemCount), 1);

  return (
    <main className="page">
      <div className="shell" style={{ paddingTop: 84 }}>
        <div className="kicker"><span className="dot" />THE POETS · 诗人</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30, flexWrap: 'wrap' }}>
          <div>
            <h1 className="search-title" style={{ marginTop: 20 }}>诗人谱系</h1>
            <p className="lede">一万三千七百余位诗人，从帝王将相到无名氏。作品数量是他们在时间里留下的音量。</p>
          </div>
          <div className="sec-side" style={{ paddingBottom: 8 }}>13,733 POETS</div>
        </div>

        <div className="filter-bar" style={{ marginTop: 48 }}>
          <button className={`chip ${!dyn ? 'active' : ''}`} onClick={() => { const n = new URLSearchParams(sp); n.delete('dyn'); setSp(n); }}>全部</button>
          {stats?.dynasties.map(d => (
            <button key={d.name} className={`chip ${dyn === d.name ? 'active' : ''}`}
              onClick={() => { const n = new URLSearchParams(sp); n.set('dyn', d.name); setSp(n); }}>
              {d.name}<span className="n">{d.authors}</span>
            </button>
          ))}
        </div>

        <div className="lib-toolbar" style={{ marginTop: 26 }}>
          <div style={{ position: 'relative', maxWidth: 320, width: '100%' }}>
            <input className="input" value={q} placeholder="搜索诗人姓名…" onChange={e => setQ(e.target.value)} style={{ paddingLeft: 40 }} />
            <span style={{ position: 'absolute', left: 16, top: 13, color: 'var(--text-3)' }}>{Icon.search({})}</span>
          </div>
          <span className="lib-count">共 <b>{total.toLocaleString('en-US')}</b> 位</span>
        </div>

        <div className="poet-list" style={{ marginTop: 10 }}>
          {items.map((a, i) => (
            <Link key={a.id} to={`/poet/${a.id}`} className="poet-row">
              <span className={`rank ${i < 3 ? 'top' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="poet-name">{tr(a.name)}</span>
                <span className="poet-dyn" style={{ marginLeft: 12 }}>{a.dynasty}</span>
              </span>
              <span className="poet-brief">{tr(briefText(a.brief || '', a.name))}</span>
              <span className="poet-count">{a.poemCount.toLocaleString('en-US')} 首</span>
              <span className="poet-bar"><i style={{ width: `${(a.poemCount / max) * 100}%` }} /></span>
            </Link>
          ))}
        </div>
        <div ref={sentinel} className="sentinel" />
        {loading && <div className="load-more"><div className="spin-loader" /></div>}
        {!loading && items.length === 0 && <div className="empty">没有找到这位诗人</div>}
        {!loading && items.length >= total && total > 0 && (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em' }}>
            — 共 {total.toLocaleString('en-US')} 位诗人 —
          </div>
        )}
      </div>
    </main>
  );
}
