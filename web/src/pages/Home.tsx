import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../hooks';
import { useLang } from '../lang';
import type { Stats } from '../types';
import { CountUp, Reveal, SectionHead } from '../components/ui';
import { HeroCanvas, Marquee, RadialChart, CharCloud } from '../components/visuals';
import { Icon } from '../components/Icon';
import { DYN_COLOR } from '../palette';

/** 按标点切句，用于竖排诗笺：每一句独立成列，避免在字中间断行 */
function toColumns(text: string, max = 6): string[] {
  const parts = text.match(/[^，。！？；：\n]{1,}[，。！？；：]?/g) || [text];
  const clean = parts.map(s => s.trim()).filter(Boolean);
  if (clean.length <= max) return clean;
  const merged = clean.slice(0, max - 1);
  merged[max - 2] = merged[max - 2] + '…';
  return merged;
}

function River({ stats }: { stats: Stats }) {
  const max = Math.max(...stats.dynasties.map(d => d.count), 1);
  return (
    <div className="river">
      <div className="river-track">
        {stats.dynasties.map((d, i) => {
          const width = 18 + (Math.log(d.count + 1) / Math.log(max + 1)) * 82;
          return (
            <Link key={d.name} to={`/library?dyn=${encodeURIComponent(d.name)}`}
              className="river-node" style={{ color: DYN_COLOR[d.name] || '#d8b36a' }}>
              <div className="bar" style={{ width: `${width}%`, animationDelay: `${i * 90}ms` }} />
              <div className="node-era mono">{d.era}</div>
              <div className="node-name">{d.name}</div>
              <div className="node-count">{d.count.toLocaleString('en-US')} 首</div>
              <div className="node-sample">
                {d.sample.slice(0, 2).map(s => <span key={s}>{s}<br /></span>)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CollectionGlyph({ i }: { i: number }) {
  const rot = (i * 37) % 360;
  return (
    <svg className="coll-art" viewBox="0 0 120 120" style={{ transform: `rotate(${rot}deg)` }}>
      {[0, 1, 2, 3].map(k => (
        <circle key={k} cx="60" cy="60" r={22 + k * 11} fill="none"
          stroke={k % 2 ? 'var(--gold)' : 'var(--jade)'} strokeOpacity={k % 2 ? '.28' : '.2'} strokeWidth="1"
          strokeDasharray={k === 1 ? '2 7' : undefined} />
      ))}
      <line x1="60" y1="16" x2="60" y2="104" stroke="var(--gold)" strokeOpacity=".18" />
      <line x1="16" y1="60" x2="104" y2="60" stroke="var(--gold)" strokeOpacity=".18" />
      <circle cx="60" cy="60" r="4" fill="var(--gold)" opacity=".45" />
    </svg>
  );
}

function FlyFlower() {
  const [ch, setCh] = useState('月');
  const [input, setInput] = useState('月');
  const { data } = useApi<any>('/lines', { char: ch, size: 9 }, ch.length > 0 && ch.length <= 2);
  const { tr } = useLang();
  const chars = ['月', '风', '花', '酒', '雪', '云', '山', '江'];
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
        <input className="input" style={{ maxWidth: 200 }} value={input} maxLength={2}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) setCh(input.trim()); }}
          placeholder="输入一个字" />
        <button className="btn small" onClick={() => input.trim() && setCh(input.trim())}>令</button>
      </div>
      <div className="filter-bar" style={{ marginBottom: 24 }}>
        {chars.map(c => (
          <button key={c} className={`chip ${ch === c ? 'active' : ''}`} onClick={() => { setCh(c); setInput(c); }}>{c}</button>
        ))}
      </div>
      <div>
        {data?.items?.map((it: any) => (
          <Link key={it.line} to={`/poem/${it.id}`}
            style={{ display: 'block', padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 17, letterSpacing: '.04em' }}>
              {tr(it.line).split(new RegExp(`(${ch})`)).map((seg, i2) =>
                seg === ch ? <span key={i2} style={{ color: 'var(--gold-2)' }}>{seg}</span> : <span key={i2}>{seg}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, letterSpacing: '.08em' }}>
              {tr(it.author)} · {it.dynasty} ·《{tr(it.title)}》
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Home() {
  const { data: stats } = useApi<Stats>('/stats');
  const { data: daily } = useApi<any>('/daily');
  const [qi, setQi] = useState(0);
  const navigate = useNavigate();
  const { tr } = useLang();
  const topImagery = (stats?.imagery || []).slice(0, 5).sort((a, b) => b.count - a.count);
  const imageryMax = topImagery[0]?.count || 1;

  useEffect(() => {
    const t = setInterval(() => setQi(v => v + 1), 9000);
    return () => clearInterval(t);
  }, []);

  const quote = stats?.quotes?.length ? stats.quotes[qi % stats.quotes.length] : null;
  const topAuthors = useMemo(() => stats?.topAuthors?.slice(0, 8) || [], [stats]);
  const maxAuthor = Math.max(...(topAuthors.map(a => a.poemCount) || [1]), 1);

  const random = async () => {
    const r = await api<{ id: string }>('/poem/random', { t: Date.now() });
    navigate(`/poem/${r.id}`);
  };

  return (
    <main className="page" style={{ paddingTop: 0 }}>
      <section className="hero">
        <HeroCanvas />
        <div className="hero-grid" />
        <div className="hero-vignette" />
        <div className="hero-ridge">
          <svg viewBox="0 0 1440 300" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <defs>
              <linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gold)" stopOpacity=".18" />
                <stop offset="100%" stopColor="var(--ink-0)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,190 C90,150 150,178 220,140 C300,96 360,150 440,120 C520,90 590,160 680,128 C760,100 820,150 900,118 C980,86 1040,150 1120,124 C1200,98 1280,150 1360,120 L1440,140 L1440,300 L0,300 Z"
              fill="url(#ridge)" />
            <path d="M0,236 C110,200 170,226 260,196 C350,166 420,214 520,186 C620,158 690,208 790,182 C890,156 960,206 1060,178 C1160,150 1240,200 1320,176 L1440,190 L1440,300 L0,300 Z"
              fill="var(--gold)" opacity=".06" />
          </svg>
        </div>

        <div className="shell hero-inner">
          <div className="hero-copy">
            <div className="hero-eyebrow mono">
              <span>CHINESE POETRY ARCHIVE</span>
              <span>·</span>
              <span>中国古典诗词数字档案</span>
            </div>
            <h1 className="hero-title">
              三千载<em>诗心</em><br />一屏可揽
            </h1>
            <div className="hero-sub">
              从《诗经》的歌谣到纳兰的词章，三十四万五千首诗词在此汇成一条长河。
              全文检索、诗人谱系、词牌与意象的数据图谱，皆在一处安静地展开。
            </div>
            <div className="hero-cta">
              <Link className="btn" to="/library">开始漫游<span className="arrow">→</span></Link>
              <button className="btn ghost" onClick={random}>{Icon.shuffle({})} 随机一首</button>
            </div>
            <div className="hero-meta">
              <div><b><CountUp value={stats?.totals.poems || 345386} /></b><span>POEMS · 诗词</span></div>
              <div><b><CountUp value={stats?.totals.authors || 13733} /></b><span>POETS · 诗人</span></div>
              <div><b><CountUp value={stats?.totals.chars || 21834450} /></b><span>CHARACTERS · 字</span></div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-watermark">诗</div>
            <div className="orbit">
              <svg viewBox="0 0 400 400">
                <circle cx="200" cy="200" r="150" fill="none" stroke="var(--gold)" strokeOpacity=".22" strokeWidth="1" />
                <circle cx="200" cy="200" r="182" fill="none" stroke="var(--gold)" strokeOpacity=".12" strokeWidth="1" strokeDasharray="1 9" />
                {Array.from({ length: 60 }).map((_, i) => {
                  const a = (i / 60) * Math.PI * 2;
                  const r1 = i % 5 === 0 ? 138 : 144;
                  return <line key={i} x1={200 + Math.cos(a) * r1} y1={200 + Math.sin(a) * r1}
                    x2={200 + Math.cos(a) * 150} y2={200 + Math.sin(a) * 150}
                    stroke="var(--gold)" strokeOpacity=".24" />;
                })}
                <path d="M200 30 L206 194 L200 200 L194 194 Z" fill="var(--gold)" opacity=".4" />
              </svg>
              <svg viewBox="0 0 400 400" className="slow">
                <circle cx="200" cy="200" r="110" fill="none" stroke="var(--jade)" strokeOpacity=".2" strokeWidth="1" />
                <circle cx="200" cy="200" r="126" fill="none" stroke="var(--gold)" strokeOpacity=".14" strokeWidth="1" strokeDasharray="3 6" />
                {[0, 90, 180, 270].map(a => (
                  <line key={a} x1={200 + Math.cos(a * Math.PI / 180) * 108} y1={200 + Math.sin(a * Math.PI / 180) * 108}
                    x2={200 + Math.cos(a * Math.PI / 180) * 128} y2={200 + Math.sin(a * Math.PI / 180) * 128}
                    stroke="var(--gold)" strokeOpacity=".22" />
                ))}
              </svg>
            </div>

            {quote && (
              <div className="poem-slip" key={qi} style={{ animation: 'floaty 9s ease-in-out infinite, fade .7s ease both' }}>
                <div className="slip-label">
                  <span>每日诗笺</span>
                  <span className="dot">●</span>
                  <span>DAILY VERSE</span>
                </div>
                <div className={`slip-verse ${quote.text.length > 32 ? 'long' : ''}`}>
                  {toColumns(quote.text, 5).map((line, i) => (
                    <div className="v-col" key={i}>{line}</div>
                  ))}
                </div>
                <div className="slip-sign">
                  <span className="who">{tr(quote.author)}《{tr(quote.title)}》</span>
                  <span className="slip-seal">詩</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <Marquee quotes={stats?.quotes || []} />
        <div className="scroll-hint"><span>SCROLL</span><i /></div>
      </section>

      <section className="stat-band">
        <div className="shell">
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-num"><CountUp value={stats?.totals.poems || 345386} /><small>首</small></div>
              <div className="stat-label">Poems · 作品</div>
              <div className="stat-sub">十二部总集，横跨先秦至清</div>
            </div>
            <div className="stat-item">
              <div className="stat-num"><CountUp value={stats?.totals.authors || 13733} /><small>位</small></div>
              <div className="stat-label">Poets · 诗人</div>
              <div className="stat-sub">有名有姓，亦有大量佚名之作</div>
            </div>
            <div className="stat-item">
              <div className="stat-num"><CountUp value={stats?.totals.lines || 1580038} /><small>行</small></div>
              <div className="stat-label">Lines · 诗句</div>
              <div className="stat-sub">每一行都可被检索与引用</div>
            </div>
            <div className="stat-item">
              <div className="stat-num"><CountUp value={stats?.totals.rhythms || 1476} /><small>调</small></div>
              <div className="stat-label">Rhythms · 词牌</div>
              <div className="stat-sub">长短句的格律星图</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            kicker="THE RIVER OF VERSE"
            title={<>一条<em>诗歌长河</em>，从先秦流到清代</>}
            desc="每一次改朝换代，都带来新的声律与题材。悬停在任一段河岸，都能听见属于那个时代的声音。"
            side="01 / TIMELINE"
          />
          {stats && <River stats={stats} />}
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            kicker="THE COLLECTIONS"
            title={<>十二部总集，构成<em>中国诗的可读全貌</em></>}
            desc="唐诗的整饬、宋诗的日常、宋词的婉转、元曲的鲜活——不同的文体，在同一条时间轴上彼此应答。"
            side="02 / CORPUS"
          />
          <div className="coll-grid">
            {(stats?.collections || []).map((c, i) => (
              <Reveal key={c.code} delay={i * 40}>
                <Link to={`/library?coll=${c.code}`} className="coll-card"
                  onMouseMove={e => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
                  }}>
                  <CollectionGlyph i={i} />
                  <div className="coll-code">{c.code} · {c.era}</div>
                  <div className="coll-name">{c.name}</div>
                  <div className="coll-count">{c.count.toLocaleString('en-US')} 首</div>
                  <div className="coll-desc">{c.desc}</div>
                  <span className="coll-arrow">↗</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="daily-wrap">
            <Reveal>
              <div>
                <div className="kicker"><span className="dot" />TODAY'S VERSE · 今日诗笺</div>
                {daily ? (
                  <>
                    <div className="daily-date" style={{ marginTop: 18 }}>
                      {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {' · '}{daily.collName}
                    </div>
                    <h2 className="daily-title">{tr(daily.title)}</h2>
                    <div className="daily-author">{tr(daily.author)} · {daily.dynasty}</div>
                    <div className="daily-text">
                      {(daily.linesArr || []).slice(0, 6).map((l: string, i: number) => (
                        <div key={i}>{tr(l)}</div>
                      ))}
                    </div>
                    <div className="daily-foot">
                      <Link className="btn small" to={`/poem/${daily.id}`}>阅读全文<span className="arrow">→</span></Link>
                      <Link className="btn ghost small" to="/library">去诗库</Link>
                    </div>
                  </>
                ) : <div className="skeleton" style={{ height: 220, marginTop: 30 }} />}
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="daily-card">
                <div className="vet">
                  {daily ? (() => {
                    const lines: string[] = (daily.linesArr || []).slice(0, 6);
                    const maxLen = Math.max(1, ...lines.map(l => l.length));
                    const size = Math.max(13, Math.min(22, 380 / maxLen));
                    return (
                      <div className="vertical" style={{ fontSize: size }}>
                        {lines.map((l, i) => <div className="v-col" key={i}>{tr(l)}</div>)}
                      </div>
                    );
                  })() : (
                    <div className="vertical-placeholder">正在展开今日诗笺…</div>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            kicker="RHYTHMS & IMAGERY"
            title={<>词牌是格律的星图，<br /><em>意象是情绪的坐标</em></>}
            desc="一千四百七十六个词牌决定了句子的长短与声调；而月、风、花、酒这些反复出现的字，暴露了中国人共同的情感结构。"
            side="03 / ATLAS"
          />
          <div className="atlas-grid">
            <div className="panel" style={{ gridColumn: 'span 7' }}>
              <div className="panel-head">
                <span className="panel-title">词牌星河</span>
                <span className="panel-label">TOP 14 / RHYTHM</span>
              </div>
              {stats && <RadialChart data={stats.topRhythms.slice(0, 14)} total={stats.totals.rhythms} size={520} />}
            </div>
            <div className="panel" style={{ gridColumn: 'span 5' }}>
              <div className="panel-head">
                <span className="panel-title">意象之海</span>
                <span className="panel-label">TOP 110 / CHARACTER</span>
              </div>
              {stats && <CharCloud data={stats.chars} limit={110} />}
              <div style={{ marginTop: 26, borderTop: '1px solid var(--line)', paddingTop: 22 }}>
                <div className="bar-list">
                  {topImagery.map(it => (
                    <div className="bar-row" key={it.name}>
                      <span className="bar-name" style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{it.name}</span>
                      <span className="bar-track"><span className="bar-fill" style={{ width: `${(it.count / imageryMax) * 100}%` }} /></span>
                      <span className="bar-val">{it.count.toLocaleString('en-US')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="atlas-grid">
            <div className="panel" style={{ gridColumn: 'span 7' }}>
              <div className="panel-head">
                <span className="panel-title">飞花令</span>
                <span className="panel-label">FIND A CHARACTER</span>
              </div>
              <FlyFlower />
            </div>
            <div className="panel" style={{ gridColumn: 'span 5' }}>
              <div className="panel-head">
                <span className="panel-title">诗人榜</span>
                <span className="panel-label">BY VOLUME</span>
              </div>
              <div>
                {topAuthors.map((a, i) => (
                  <Link key={a.id} to={`/poet/${a.id}`}
                    style={{ display: 'block', padding: '13px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                      <span className="rank" style={{ width: 26, color: i < 3 ? 'var(--gold)' : 'var(--text-3)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 21, letterSpacing: '.08em' }}>{tr(a.name)}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{a.dynasty}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--gold-3)' }}>
                        {a.poemCount.toLocaleString('en-US')} 首
                      </span>
                    </div>
                    <div className="poet-bar" style={{ marginTop: 8 }}>
                      <i style={{ width: `${(a.poemCount / maxAuthor) * 100}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
              <div style={{ marginTop: 24 }}>
                <Link className="btn ghost small" to="/poets">全部诗人<span className="arrow">→</span></Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
