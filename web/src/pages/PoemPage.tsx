import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../hooks';
import { useLang } from '../lang';
import { loadFavs, saveFavs } from '../favorites';
import type { PoemDetail } from '../types';
import { Icon } from '../components/Icon';

export function PoemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { data: p, error } = useApi<PoemDetail>(`/poem/${id}`, undefined, !!id);
  const { tr, lang } = useLang();
  const [vertical, setVertical] = useState(() => {
    try { return localStorage.getItem('molan-vertical') === '1'; } catch { return false; }
  });
  const [fav, setFav] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setFav(loadFavs().includes(id || '')); }, [id]);
  useEffect(() => {
    try { localStorage.setItem('molan-vertical', vertical ? '1' : '0'); } catch {}
  }, [vertical]);

  const toggleFav = () => {
    const favs = loadFavs();
    const next = favs.includes(id!) ? favs.filter(x => x !== id) : [...favs, id!];
    saveFavs(next);
    setFav(next.includes(id!));
  };

  const copy = async () => {
    if (!p) return;
    const text = `${p.title}\n${p.author} · ${p.dynasty}\n\n${p.linesArr.join('\n')}\n\n—— 墨澜 · ${p.collName}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  if (error) return (
    <main className="page"><div className="shell" style={{ paddingTop: 120 }}>
      <div className="error-box">没有找到这首诗。<Link to="/library" className="back-link" style={{ marginTop: 20, display: 'inline-flex' }}>← 返回诗库</Link></div>
    </div></main>
  );

  if (!p) return (
    <main className="page"><div className="shell" style={{ paddingTop: 160 }}>
      <div className="spin-loader" />
    </div></main>
  );

  const backColl = sp.get('coll') || p.coll;
  const lines = p.linesArr || [];
  const showVertical = vertical && lines.length <= 24;
  const vCols: string[] = [];
  if (showVertical) {
    for (const line of lines) {
      const parts = line.split(/(?<=[，。！？；：、])/u).filter(Boolean);
      for (const part of parts) {
        if (part.length <= 18) { vCols.push(part); continue; }
        for (let i = 0; i < part.length; i += 18) vCols.push(part.slice(i, i + 18));
      }
    }
  }

  return (
    <main className="page">
      <div className="poem-page shell">
        <div className="poem-hero">
          <div className="poem-kicker">
            <span>{p.dynasty}</span><span className="sep">/</span>
            <span>{p.collName}</span>
            {p.rhythm && <><span className="sep">/</span><span>{tr(p.rhythm)}</span></>}
          </div>
          <h1 className="poem-title">{tr(p.title)}</h1>
          <div className="poem-by">
            <span className="seal">詩</span>
            <Link to={`/poet/${p.aid}`} style={{ color: 'var(--gold-2)' }}>{tr(p.author)}</Link>
            <span style={{ color: 'var(--text-3)' }}>·</span>
            <span>{p.dynasty}</span>
          </div>
          {p.tags?.length > 0 && (
            <div className="poem-tags">
              {p.tags.slice(0, 5).map(t => <span key={t}>{tr(t)}</span>)}
            </div>
          )}
        </div>

        <div className="poem-layout">
          <div className="poem-main">
            <div className="poem-tools">
              {lines.length <= 24 && (
                <button className={`tool ${ vertical ? 'on' : ''}`} onClick={() => setVertical(v => !v)}>
                  {Icon.vertical({})} {vertical ? '横排阅读' : '竖排阅读'}
                </button>
              )}
              <button className={`tool ${fav ? 'on' : ''}`} onClick={toggleFav}>{Icon.heart({})} {fav ? '已收藏' : '收藏'}</button>
              {fav && <Link className="tool" to="/favorites">查看收藏 →</Link>}
              <button className="tool" onClick={copy}>{Icon.copy({})} {copied ? '已复制' : '复制'}</button>
              <button className="tool" onClick={async () => {
                const r = await api<{ id: string }>('/poem/random', { t: Date.now() });
                navigate(`/poem/${r.id}`);
              }}>{Icon.shuffle({})} 随机</button>
            </div>

            <div className={`poem-body ${showVertical ? 'vertical' : ''}`}>
              {showVertical
                ? vCols.map((c, i) => (
                    <span className="vline" key={i} style={{ animationDelay: `${i * 45}ms` }}>{tr(c)}</span>
                  ))
                : lines.map((l, i) => (
                    <span className="line" key={i} style={{ animationDelay: `${i * 55}ms` }}>{tr(l)}</span>
                  ))}
            </div>

            <div className="poem-foot">
              <span>{p.len} 字</span>
              <span>{lines.length} 行</span>
              {p.pop > 0 && <span>热度 {p.pop.toFixed(1)}</span>}
              <span>{p.collName}</span>
            </div>
          </div>

          <aside className="poem-aside">
            {p.authorInfo && (
              <div className="aside-card">
                <div className="aside-title">作者 · POET</div>
                <Link to={`/poet/${p.aid}`} style={{ display: 'block' }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 26, letterSpacing: '.1em' }}>{tr(p.author)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{p.dynasty} · 存诗 {p.authorInfo.poemCount} 首</div>
                </Link>
                <div className="aside-body" style={{ marginTop: 14 }}>
                  {(p.authorInfo.bio || '生平资料未载。').slice(0, 120)}
                  {p.authorInfo.bio && p.authorInfo.bio.length > 120 ? '…' : ''}
                </div>
              </div>
            )}

            {p.notes?.length > 0 && (
              <div className="aside-card">
                <div className="aside-title">注释 · NOTES</div>
                <div className="aside-body">
                  {p.notes.map((n, i) => <span className="note" key={i}>{tr(n)}</span>)}
                </div>
              </div>
            )}

            {p.prologue && (
              <div className="aside-card">
                <div className="aside-title">赏析 · READING</div>
                <div className="aside-body" style={{ fontFamily: 'var(--serif)', lineHeight: 2 }}>{tr(p.prologue)}</div>
              </div>
            )}

            <div className="aside-card">
              <div className="aside-title">档案 · RECORD</div>
              <div className="aside-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>总集</span><span style={{ color: 'var(--text)' }}>{p.collName}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>朝代</span><span style={{ color: 'var(--text)' }}>{p.dynasty}</span></div>
                {p.rhythm && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>词牌</span><span style={{ color: 'var(--text)' }}>{tr(p.rhythm)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>字数</span><span style={{ color: 'var(--text)' }}>{p.len}</span></div>
              </div>
            </div>
          </aside>
        </div>

        {(p.sameAuthor.length > 0 || p.sameRhythm.length > 0) && (
          <div style={{ maxWidth: 1080, margin: '90px auto 0' }}>
            {p.sameAuthor.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div className="panel-head">
                  <span className="panel-title">同为{tr(p.author)}所作</span>
                  <Link className="panel-label" to={`/poet/${p.aid}`}>全部作品 →</Link>
                </div>
                <div className="lib-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {p.sameAuthor.slice(0, 4).map(x => (
                    <Link key={x.id} to={`/poem/${x.id}`} className="poem-card" style={{ minHeight: 150 }}>
                      <div className="pc-head"><span className="pc-dyn">{x.dynasty}</span><span className="pc-coll">{x.len} 字</span></div>
                      <div className="pc-title" style={{ fontSize: 18 }}>{tr(x.title)}</div>
                      <div className="pc-lead" style={{ marginTop: 8, WebkitLineClamp: 2 }}>{tr(x.lead)}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {p.sameRhythm.length > 0 && (
              <div>
                <div className="panel-head">
                  <span className="panel-title">同调 · {tr(p.rhythm)}</span>
                  <Link className="panel-label" to={`/library?tag=${encodeURIComponent(p.tags[0] || '')}`}>更多 →</Link>
                </div>
                <div className="lib-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {p.sameRhythm.slice(0, 3).map(x => (
                    <Link key={x.id} to={`/poem/${x.id}`} className="poem-card" style={{ minHeight: 140 }}>
                      <div className="pc-title" style={{ fontSize: 17 }}>{tr(x.title)}</div>
                      <div className="pc-author">{tr(x.author)}</div>
                      <div className="pc-lead" style={{ marginTop: 6 }}>{tr(x.lead)}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="poem-pager">
          {p.prev ? (
            <Link className="pager-item" to={`/poem/${p.prev.id}`}>
              <small>← PREVIOUS</small><b>{tr(p.prev.title)}</b>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tr(p.prev.author)}</span>
            </Link>
          ) : <div style={{ flex: 1 }} />}
          {p.next ? (
            <Link className="pager-item next" to={`/poem/${p.next.id}`}>
              <small>NEXT →</small><b>{tr(p.next.title)}</b>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tr(p.next.author)}</span>
            </Link>
          ) : <div style={{ flex: 1 }} />}
        </div>

        <div style={{ textAlign: 'center', marginTop: 50 }}>
          <Link className="back-link" to={`/library?coll=${backColl}`}>← 返回{tr(p.collName)}</Link>
        </div>
      </div>
    </main>
  );
}
