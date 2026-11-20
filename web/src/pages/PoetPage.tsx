import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../hooks';
import { useLang } from '../lang';
import type { PoetDetail } from '../types';
import { PoemCard } from '../components/PoemCard';

export function PoetPage() {
  const { id } = useParams();
  const { data: a, error } = useApi<PoetDetail>(`/poet/${id}`, undefined, !!id);
  const { tr } = useLang();
  const [expand, setExpand] = useState(false);

  if (error) return (
    <main className="page"><div className="shell" style={{ paddingTop: 120 }}>
      <div className="error-box">没有找到这位诗人。<Link to="/poets" className="back-link">← 返回诗人</Link></div>
    </div></main>
  );

  if (!a) return <main className="page"><div className="shell" style={{ paddingTop: 160 }}><div className="spin-loader" /></div></main>;

  const collNames = a.collections.map(c => ({ tang: '全唐诗', songshi: '全宋诗', songci: '全宋词', yuanqu: '元曲', shijing: '诗经', chuci: '楚辞', huajian: '花间集', nantang: '南唐二主词', qianjia: '千家诗', shuimo: '水墨唐诗', nalan: '纳兰词', caocao: '曹操诗集' } as any)[c] || c);

  return (
    <main className="page">
      <section className="poet-hero">
        <div className="shell hero-inner" style={{ gridTemplateColumns: '1fr', gap: 0 }}>
          <div className="poet-hero-grid">
            <div>
              <div className="kicker"><span className="dot" />POET · {a.dynasty}</div>
              <h1 className="poet-giant">{tr(a.name)}</h1>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                {collNames.map(c => <span key={c} className="chip" style={{ padding: '4px 12px', fontSize: 11 }}>{c}</span>)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="poet-stats" style={{ justifyContent: 'flex-end' }}>
                <div><b>{a.poemCount.toLocaleString('en-US')}</b><span>存诗 · POEMS</span></div>
                <div><b>{a.charCount.toLocaleString('en-US')}</b><span>字数 · CHARS</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="shell">
          <div className="poem-layout" style={{ gridTemplateColumns: '1fr 320px', maxWidth: 1200 }}>
            <div>
              <div className="aside-title" style={{ marginBottom: 16 }}>生平 · BIOGRAPHY</div>
              {a.bio ? (
                <>
                  <div className={`bio ${expand ? '' : 'clamp'}`} style={{ fontFamily: 'var(--serif)' }}>{tr(a.bio)}</div>
                  {a.bio.length > 260 && (
                    <div className="bio-more" onClick={() => setExpand(v => !v)}>{expand ? '收起 ↑' : '展开全文 ↓'}</div>
                  )}
                </>
              ) : (
                <div className="bio" style={{ color: 'var(--text-3)' }}>生平资料未载于本档案。这位诗人留下的，只有作品本身。</div>
              )}

              <div style={{ marginTop: 60 }}>
                <div className="panel-head">
                  <span className="panel-title">作品 · {a.total.toLocaleString('en-US')} 首</span>
                  <Link className="panel-label" to={`/library?author=${encodeURIComponent(a.name)}`}>在诗库中查看全部 →</Link>
                </div>
                <div className="lib-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {a.works.slice(0, 12).map((w, i) => <PoemCard key={w.id} poem={w} delay={i * 22} />)}
                </div>
              </div>
            </div>

            <aside className="poem-aside">
              <div className="aside-card">
                <div className="aside-title">常用字 · VOCABULARY</div>
                <div className="char-chips">
                  {a.topChars.map(c => (
                    <span key={c.c} title={`${c.n} 次`} style={{ fontSize: 16 + Math.min(10, c.n / 40) }}>{c.c}</span>
                  ))}
                </div>
              </div>
              <div className="aside-card">
                <div className="aside-title">档案 · RECORD</div>
                <div className="aside-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>朝代</span><span style={{ color: 'var(--text)' }}>{a.dynasty}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>存诗</span><span style={{ color: 'var(--text)' }}>{a.poemCount} 首</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>字数</span><span style={{ color: 'var(--text)' }}>{a.charCount.toLocaleString('en-US')}</span></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
