import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../hooks';
import { useLang } from '../lang';
import type { Stats } from '../types';
import { Icon } from '../components/Icon';

export function SearchPage() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') || '';
  const coll = sp.get('coll') || '';
  const [input, setInput] = useState(q);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: stats } = useApi<Stats>('/stats');
  const { data: poets } = useApi<any>('/poets', { q, size: 5 }, q.length > 0);
  const { tr } = useLang();

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => { setPage(1); setItems([]); setTotal(0); setHasMore(false); }, [q, coll]);

  useEffect(() => {
    if (!q) { setItems([]); setTotal(0); setHasMore(false); return; }
    let alive = true;
    setLoading(true);
    api<any>('/search', { q, coll: coll || undefined, page, size: 12 }).then(r => {
      if (!alive) return;
      setTotal(r.total);
      setHasMore(!!r.hasMore);
      setItems(prev => (page === 1 ? r.items : [...prev, ...r.items]));
      setLoading(false);
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [q, coll, page]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = new URLSearchParams(sp);
    if (input.trim()) n.set('q', input.trim()); else n.delete('q');
    n.delete('page');
    setSp(n);
  };

  const setColl = (c: string) => {
    const n = new URLSearchParams(sp);
    if (c) n.set('coll', c); else n.delete('coll');
    setSp(n);
  };

  return (
    <main className="page">
      <div className="shell">
        <div className="search-hero">
          <div className="kicker"><span className="dot" />FULL-TEXT SEARCH · 全文检索</div>
          <h1 className="search-title" style={{ marginTop: 20 }}>在诗句里找一个人，或一个字</h1>
          <form className="search-bar" onSubmit={submit}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input className="input" value={input} autoFocus placeholder="试试「明月」「李白」「江南」…"
                onChange={e => setInput(e.target.value)} style={{ paddingLeft: 48 }} />
              <span style={{ position: 'absolute', left: 20, top: 20, color: 'var(--text-3)' }}>{Icon.search({})}</span>
            </div>
            <button className="btn" type="submit">检索<span className="arrow">→</span></button>
          </form>

          {q && (
            <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="lib-count">
                {hasMore ? '已找到' : '共'} <b>{total.toLocaleString('en-US')}</b> 条
                {hasMore ? '，继续加载查看更多' : ''}
              </span>
              <button className={`chip ${!coll ? 'active' : ''}`} onClick={() => setColl('')}>全部总集</button>
              {stats?.collections.slice(0, 7).map(c => (
                <button key={c.code} className={`chip ${coll === c.code ? 'active' : ''}`} onClick={() => setColl(c.code)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {q && poets?.items?.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div className="aside-title" style={{ marginBottom: 12 }}>相关诗人</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {poets.items.map((p: any) => (
                <Link key={p.id} to={`/poet/${p.id}`} className="chip" style={{ padding: '10px 18px' }}>
                  {tr(p.name)}<span className="n" style={{ marginLeft: 8 }}>{p.dynasty} · {p.poemCount} 首</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {q ? (
          <>
            <div className="results">
              {items.map((r, i) => (
                <Link key={r.id + i} to={`/poem/${r.id}`} className="result-row">
                  <div className="result-title">{tr(r.title)}</div>
                  <div className="result-meta">
                    {tr(r.author)} · {r.dynasty} · {r.collName} {r.rhythm ? `· ${tr(r.rhythm)}` : ''} · {r.len} 字
                    {r.where === 'title' && <span style={{ marginLeft: 10, color: 'var(--gold-3)' }}>题名命中</span>}
                  </div>
                  <div className="result-snippet" dangerouslySetInnerHTML={{ __html: r.snippet || '' }} />
                </Link>
              ))}
            </div>
            {loading && <div className="load-more"><div className="spin-loader" /></div>}
            {!loading && (hasMore || items.length < total) && (
              <div className="load-more">
                <button className="btn ghost small" onClick={() => setPage(p => p + 1)}>加载更多</button>
              </div>
            )}
            {!loading && items.length === 0 && total === 0 && !hasMore && <div className="empty">没有找到「{q}」相关的诗句</div>}
          </>
        ) : (
          <div className="empty" style={{ paddingTop: 60 }}>
            输入任意字词，开始检索三十四万五千首诗
          </div>
        )}
      </div>
    </main>
  );
}
