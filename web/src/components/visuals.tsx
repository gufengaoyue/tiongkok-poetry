import { useEffect, useMemo, useRef } from 'react';

/* ---------------- 星尘画布 ---------------- */
export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, t = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const mouse = { x: -999, y: -999 };
    const parts = Array.from({ length: 130 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.5 + 0.35,
      a: Math.random() * 0.45 + 0.08,
      v: Math.random() * 0.00035 + 0.00012,
      s: Math.random() * 0.9 + 0.2,
      p: Math.random() * Math.PI * 2,
    }));
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      w = box.width; h = box.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const onMove = (e: MouseEvent) => {
      const box = canvas.getBoundingClientRect();
      mouse.x = e.clientX - box.left; mouse.y = e.clientY - box.top;
    };
    window.addEventListener('mousemove', onMove);

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.v;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        const x = p.x * w + Math.sin(t * 0.0006 * p.s + p.p) * 22;
        const y = p.y * h;
        const dx = x - mouse.x, dy = y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const push = d < 130 ? (130 - d) / 130 : 0;
        ctx.beginPath();
        ctx.arc(x + (d ? dx / d * push * 16 : 0), y + (d ? dy / d * push * 16 : 0), p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226, 193, 130, ${p.a * (1 - push * 0.45)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);
  return <canvas ref={ref} className="hero-canvas" />;
}

/* ---------------- 名句跑马灯 ---------------- */
export function Marquee({ quotes }: { quotes: { text: string; author: string; title: string }[] }) {
  const items = useMemo(() => {
    if (!quotes?.length) return [];
    return [...quotes, ...quotes];
  }, [quotes]);
  if (!items.length) return null;
  return (
    <div className="hero-marquee">
      <div className="marq-track">
        {items.map((q, i) => (
          <span key={i}>{q.text}<em>{q.author}</em></span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 词牌极坐标图 ---------------- */
export function RadialChart({ data, total, size = 520 }: { data: { name: string; count: number }[]; total: number; size?: number }) {
  const items = data.slice(0, 14);
  const max = Math.max(...items.map(d => d.count), 1);
  const cx = size / 2, cy = size / 2;
  const r0 = size * 0.155;
  const rMax = size * 0.335;
  const step = (Math.PI * 2) / items.length;

  return (
    <div className="radial-wrap" style={{ minHeight: size * 0.86 }}>
      <svg className="radial-svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <radialGradient id="rg" cx="50%" cy="50%" r="62%">
            <stop offset="0%" stopColor="rgba(216,179,106,.18)" />
            <stop offset="100%" stopColor="rgba(216,179,106,0)" />
          </radialGradient>
          <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0d9a8" />
            <stop offset="100%" stopColor="rgba(216,179,106,.28)" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={size * 0.39} fill="url(#rg)" />
        {[0.415, 0.445, 0.475].map((k, i) => (
          <circle key={i} cx={cx} cy={cy} r={size * k} fill="none"
            stroke="rgba(232,222,200,.06)" strokeDasharray={i === 1 ? '2 8' : undefined} />
        ))}
        {Array.from({ length: 72 }).map((_, i) => {
          const a = (i / 72) * Math.PI * 2;
          return <line key={i} x1={cx + Math.cos(a) * size * 0.455} y1={cy + Math.sin(a) * size * 0.455}
            x2={cx + Math.cos(a) * size * 0.478} y2={cy + Math.sin(a) * size * 0.478}
            stroke="rgba(216,179,106,.16)" strokeWidth="1" />;
        })}
        {items.map((d, i) => {
          const a = i * step - Math.PI / 2 + step * 0.12;
          const len = (d.count / max) * (rMax - r0) + 8;
          const x1 = cx + Math.cos(a) * r0, y1 = cy + Math.sin(a) * r0;
          const x2 = cx + Math.cos(a) * (r0 + len), y2 = cy + Math.sin(a) * (r0 + len);
          const lx = cx + Math.cos(a) * (rMax + 26);
          const ly = cy + Math.sin(a) * (rMax + 26);
          const flip = Math.cos(a) < 0;
          return (
            <g key={d.name} className="radial-item">
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#bar)" strokeWidth={9}
                strokeLinecap="round" opacity={0.35 + (d.count / max) * 0.55} />
              <circle cx={x2} cy={y2} r={2.6} fill="#f0d9a8" opacity={0.75} />
              <text x={lx} y={ly} fill="#8d887c" fontSize="10.5" fontFamily="Molan Serif, serif"
                textAnchor={flip ? 'end' : 'start'} dominantBaseline="middle" letterSpacing="1">
                {d.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="radial-center">
        <b>{total.toLocaleString('en-US')}</b>
        <span>CI RHYTHMS · 词牌</span>
      </div>
    </div>
  );
}

/* ---------------- 高频字云 ---------------- */
export function CharCloud({ data, limit = 110 }: { data: { c: string; n: number }[]; limit?: number }) {
  const items = data.slice(0, limit);
  const max = Math.max(...items.map(i => i.n), 1);
  const min = Math.min(...items.map(i => i.n), 0);
  return (
    <div className="cloud">
      {items.map((d, i) => {
        const k = (d.n - min) / (max - min || 1);
        const fs = 12 + Math.pow(k, 0.75) * 46;
        const color = i % 11 === 0 ? '#74c8b6' : i % 5 === 0 ? '#d8b36a' : i % 3 === 0 ? '#c8c1af' : '#9a958a';
        return (
          <span key={d.c} title={`${d.c} · ${d.n.toLocaleString()} 次`}
            style={{ fontSize: fs, opacity: 0.42 + k * 0.55, color, fontWeight: k > 0.8 ? 600 : 400, transform: `translateY(${(i % 7) * 1.5}px)` }}>
            {d.c}
          </span>
        );
      })}
    </div>
  );
}

/* ---------------- 横向条形 ---------------- */
export function BarList({ data, unit = '', max }: { data: { label: string; value: number }[]; unit?: string; max?: number }) {
  const m = max ?? Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bar-list">
      {data.map((d, i) => (
        <div className="bar-row" key={d.label + i}>
          <span className="bar-name">{d.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(d.value / m) * 100}%`, animationDelay: `${i * 60}ms` }} />
          </span>
          <span className="bar-val">{d.value.toLocaleString('en-US')}{unit}</span>
        </div>
      ))}
    </div>
  );
}
