import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../hooks';
import { useLang } from '../lang';
import type { Stats, PoetBrief } from '../types';
import { BarList, CharCloud, RadialChart } from '../components/visuals';
import { SectionHead } from '../components/ui';
import { DYN_COLOR } from '../palette';

function DynastyBands({ stats }: { stats: Stats }) {
  const total = stats.totals.poems;
  const logs = stats.dynasties.map(d => ({ ...d, v: Math.log10(d.count + 2) }));
  const sum = logs.reduce((s, d) => s + d.v, 0);
  return (
    <div>
      <div className="dyn-scroll">
        <div className="dyn-band">
          {logs.map(d => (
            <div key={d.name} title={`${d.name} ${d.count}`}
              style={{ width: `${(d.v / sum) * 100}%`, background: `linear-gradient(180deg, ${DYN_COLOR[d.name]}44, ${DYN_COLOR[d.name]}18)`,
                borderRight: '1px solid var(--line-strong)', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: 7, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.06em', color: DYN_COLOR[d.name] }}>{d.name}</span>
              <span style={{ position: 'absolute', left: 9, bottom: 7, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
                {(d.count / total * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="dyn-legend">
        {stats.dynasties.map(d => (
          <div key={d.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <i style={{ width: 6, height: 6, borderRadius: '50%', background: DYN_COLOR[d.name], display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{d.name}</span>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-3)', marginTop: 5 }}>{d.count.toLocaleString('en-US')} 首</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{d.era}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageryRadar({ data, size = 520 }: { data: { name: string; count: number }[]; size?: number }) {
  const items = data.slice(0, 26);
  const max = Math.max(...items.map(i => i.count), 1);
  const cx = size / 2, cy = size / 2;
  const rMax = size * 0.36;
  const step = (Math.PI * 2) / items.length;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size }}>
      <defs>
        <radialGradient id="ir" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--jade)" stopOpacity=".12" />
          <stop offset="70%" stopColor="var(--gold)" stopOpacity=".06" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={rMax + 40} fill="url(#ir)" />
      {Array.from({ length: 4 }).map((_, i) => (
        <circle key={i} cx={cx} cy={cy} r={rMax * (0.35 + i * 0.22)} fill="none" stroke="var(--line)" />
      ))}
      {items.map((it, i) => {
        const a = i * step - Math.PI / 2;
        const r = 46 + (it.count / max) * rMax;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const lx = cx + Math.cos(a) * (r + 20), ly = cy + Math.sin(a) * (r + 20);
        return (
          <g key={it.name}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-strong)" strokeWidth="1" />
            <circle cx={x} cy={y} r={3 + (it.count / max) * 7} fill="var(--gold)" opacity={0.25 + (it.count / max) * 0.55} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fontSize={11 + (it.count / max) * 8} fontFamily="Molan Serif, serif" fill="var(--text-2)" opacity={0.5 + (it.count / max) * 0.5}>
              {it.name}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={3} fill="var(--gold)" />
    </svg>
  );
}

function Histogram({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="hist">
      {data.map((d, i) => (
        <div className="hist-col" key={d.label}>
          <div className="hist-bar" style={{ height: `${(d.count / max) * 100}%`, animationDelay: `${i * 70}ms` }}
            title={`${d.label}：${d.count.toLocaleString()} 首`} />
          <span className="hist-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function PoetScatter({ poets, dynasties }: { poets: PoetBrief[]; dynasties: Stats['dynasties'] }) {
  const { tr } = useLang();
  const navigate = useNavigate();
  const [tip, setTip] = useState<{ x: number; y: number; p: PoetBrief } | null>(null);
  const W = 1100, H = 430, PL = 64, PR = 26, PT = 34, PB = 62;
  const data = [...poets].sort((a, b) => b.poemCount - a.poemCount).slice(0, 240);
  const yMax = Math.max(...data.map(p => p.poemCount), 1000);
  const yMin = 300;
  const yOf = (n: number) => {
    const lv = (Math.log10(Math.max(n, yMin)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin));
    return H - PB - Math.max(0, Math.min(1, lv)) * (H - PT - PB);
  };
  const xOf = (i: number) => PL + (i / Math.max(1, data.length - 1)) * (W - PL - PR);
  const rOf = (n: number) => 2.6 + Math.min(5.4, Math.sqrt(n) / 9);
  const line = data.map((p, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(p.poemCount).toFixed(1)}`).join(' ');
  const top = data[0];

  return (
    <div className="scatter-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="scatter" style={{ width: '100%' }}>
        <defs>
          <linearGradient id="poetCurve" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity=".45" />
            <stop offset="55%" stopColor="var(--jade)" stopOpacity=".22" />
            <stop offset="100%" stopColor="var(--jade)" stopOpacity=".05" />
          </linearGradient>
        </defs>

        {[300, 1000, 3000, 9000].filter(v => v <= yMax).map(v => {
          const y = yOf(v);
          return (
            <g key={v}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--line)" strokeDasharray="2 7" />
              <text x={PL - 12} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10.5"
                fontFamily="IBM Plex Mono" fill="var(--text-3)">{v >= 1000 ? `${v / 1000}k` : v}</text>
            </g>
          );
        })}

        {[0, 60, 120, 180, 239].filter(i => i < data.length).map(i => (
          <g key={i}>
            <line x1={xOf(i)} y1={PT} x2={xOf(i)} y2={H - PB} stroke="var(--line)" strokeOpacity=".55" />
            <text x={xOf(i)} y={H - PB + 22} textAnchor="middle" fontSize="10.5"
              fontFamily="IBM Plex Mono" fill="var(--text-3)">{i + 1}</text>
          </g>
        ))}
        <text x={W - PR} y={H - 18} textAnchor="end" fontSize="10.5"
          fontFamily="IBM Plex Mono" fill="var(--text-3)" letterSpacing="1.5">存诗量排名 · RANK BY VOLUME</text>

        {data.length > 1 && (
          <path d={line} fill="none" stroke="url(#poetCurve)" strokeWidth="1.3" />
        )}

        {data.map((p, i) => {
          const c = DYN_COLOR[p.dynasty] || '#d8b36a';
          return (
            <circle key={p.id} cx={xOf(i)} cy={yOf(p.poemCount)} r={rOf(p.poemCount)}
              fill={c} fillOpacity={0.16 + Math.min(0.6, p.poemCount / 6000)}
              stroke="var(--line-strong)" strokeWidth=".6"
              onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, p })}
              onMouseMove={e => setTip({ x: e.clientX, y: e.clientY, p })}
              onMouseLeave={() => setTip(null)}
              onClick={() => navigate(`/poet/${p.id}`)}
              style={{ cursor: 'pointer', transition: 'fill-opacity .2s' }} />
          );
        })}

        {top && (
          <g pointerEvents="none">
            <circle cx={xOf(0)} cy={yOf(top.poemCount)} r={rOf(top.poemCount) + 8}
              fill="none" stroke="var(--gold)" strokeOpacity=".45" strokeDasharray="2 5" />
            <line x1={xOf(0)} y1={yOf(top.poemCount) - 8} x2={xOf(0) + 14} y2={PT - 4}
              stroke="var(--gold)" strokeOpacity=".55" strokeWidth=".8" />
            <text x={xOf(0) + 18} y={PT + 1} fontSize="11" fontFamily="Molan Serif, serif" fill="var(--gold-2)">
              {tr(top.name)} · {top.poemCount.toLocaleString('en-US')} 首
            </text>
          </g>
        )}

        {dynasties.map((d, i) => (
          <g key={d.name} transform={`translate(${W - PR - 268 + i * 38}, 16)`}>
            <circle cx="0" cy="0" r="2.6" fill={DYN_COLOR[d.name]} />
            <text x="7" y="3.4" fontSize="10.5" fontFamily="Molan Serif, serif" fill="var(--text-3)">{d.name}</text>
          </g>
        ))}
      </svg>
      {tip && (
        <div className="scatter-tip" style={{ left: tip.x, top: tip.y }}>
          <b>{tr(tip.p.name)}</b>
          <div style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{tip.p.dynasty} · {tip.p.poemCount.toLocaleString('en-US')} 首</div>
        </div>
      )}
    </div>
  );
}

export function Atlas() {
  const { data: stats } = useApi<Stats>('/stats');
  const [poets, setPoets] = useState<PoetBrief[]>([]);

  useEffect(() => {
    let alive = true;
    const all: PoetBrief[] = [];
    const pages = [1, 2, 3, 4];
    Promise.all(pages.map(pg => api<any>('/poets', { page: pg, size: 60 })))
      .then(rs => {
        if (!alive) return;
        rs.forEach(r => all.push(...r.items));
        setPoets(all.filter(p => p.poemCount > 0));
      }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <main className="page">
      <div className="shell" style={{ paddingTop: 84 }}>
        <div className="kicker"><span className="dot" />THE ATLAS · 数据图谱</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30, flexWrap: 'wrap' }}>
          <div>
            <h1 className="search-title" style={{ marginTop: 20 }}>诗歌的另一种读法</h1>
            <p className="lede">把三十四万五千首诗拆成数据：朝代、词牌、字数、意象与诗人的产量，会呈现出一条隐形的结构。</p>
          </div>
          <div className="sec-side" style={{ paddingBottom: 8 }}>7 DYNASTIES · 1,476 RHYTHMS</div>
        </div>
      </div>

      <div className="shell" style={{ paddingTop: 56 }}>
        <div className="atlas-grid">
          <div className="panel wide">
            <div className="panel-head">
              <span className="panel-title">朝代分布</span>
              <span className="panel-label">01 / BY DYNASTY · LOG SCALE</span>
            </div>
            {stats && <DynastyBands stats={stats} />}
          </div>

          <div className="panel half">
            <div className="panel-head">
              <span className="panel-title">词牌星河</span>
              <span className="panel-label">02 / TOP 14</span>
            </div>
            {stats && <RadialChart data={stats.topRhythms} total={stats.totals.rhythms} size={460} />}
          </div>

          <div className="panel half">
            <div className="panel-head">
              <span className="panel-title">意象星图</span>
              <span className="panel-label">03 / IMAGERY</span>
            </div>
            {stats && <ImageryRadar data={stats.imagery} size={470} />}
          </div>

          <div className="panel wide">
            <div className="panel-head">
              <span className="panel-title">高频字之海</span>
              <span className="panel-label">04 / TOP 120 CHARACTERS</span>
            </div>
            {stats && <CharCloud data={stats.chars} limit={120} />}
          </div>

          <div className="panel third">
            <div className="panel-head">
              <span className="panel-title">篇幅分布</span>
              <span className="panel-label">05 / LENGTH</span>
            </div>
            {stats && <Histogram data={stats.lengthDist} />}
          </div>

          <div className="panel third">
            <div className="panel-head">
              <span className="panel-title">词牌前二十</span>
              <span className="panel-label">06 / RHYTHMS</span>
            </div>
            {stats && <BarList data={stats.topRhythms.slice(0, 10).map(r => ({ label: r.name, value: r.count }))} unit=" 首" />}
          </div>

          <div className="panel third">
            <div className="panel-head">
              <span className="panel-title">诗人产量</span>
              <span className="panel-label">07 / PRODUCTIVITY</span>
            </div>
            {stats && <BarList data={stats.authorDist.map(a => ({ label: a.label, value: a.count }))} unit=" 人" />}
            <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.9 }}>
              大多数诗人只留下个位数的作品；而少数高产者，一人即可撑起一个时代。
            </div>
          </div>

          <div className="panel wide">
            <div className="panel-head">
              <span className="panel-title">诗人星图</span>
              <span className="panel-label">08 / TOP 240 POETS · BY VOLUME</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
              横轴为存诗量排名，纵轴为作品数量（对数刻度），圆点颜色对应朝代。点击进入诗人页。
            </div>
            {stats && <PoetScatter poets={poets} dynasties={stats.dynasties} />}
          </div>
        </div>

        <div style={{ marginTop: 70, textAlign: 'center' }}>
          <Link className="btn ghost" to="/library">回到诗库<span className="arrow">→</span></Link>
        </div>
      </div>
    </main>
  );
}
