import { useEffect, useRef, useState } from 'react';
import { useCountUp, useReveal } from '../hooks';

export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function CountUp({ value, suffix = '', duration = 1800 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [start, setStart] = useState(false);
  const v = useCountUp(value, duration, start);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { setStart(true); io.disconnect(); } });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <span ref={ref}>{(start ? v : 0).toLocaleString('en-US')}{suffix}</span>;
}

export function SectionHead({
  kicker, title, desc, side,
}: { kicker: string; title: React.ReactNode; desc?: string; side?: string }) {
  return (
    <div className="sec-head">
      <div>
        <div className="kicker"><span className="dot" />{kicker}</div>
        <h2 className="h2">{title}</h2>
        {desc && <p className="lede">{desc}</p>}
      </div>
      {side && <div className="sec-side">{side}</div>}
    </div>
  );
}

export function Spotlight({ className, children, ...rest }: any) {
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div className={className} onMouseMove={onMove} {...rest}>
      {children}
    </div>
  );
}
