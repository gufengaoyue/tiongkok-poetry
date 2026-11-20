import { Link } from 'react-router-dom';
import { useLang } from '../lang';
import type { PoemBrief } from '../types';

export function PoemCard({ poem, delay = 0 }: { poem: PoemBrief; delay?: number }) {
  const { tr } = useLang();
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <Link to={`/poem/${poem.id}`} className="poem-card" onMouseMove={onMove}
      style={{ animation: `lineIn .7s var(--ease) ${delay}ms both` }}>
      <div className="pc-head">
        <span className="pc-dyn">{poem.dynasty}</span>
        <span className="pc-coll">{poem.collName}</span>
      </div>
      <div className="pc-title">{tr(poem.title)}</div>
      <div className="pc-author">{tr(poem.author)}</div>
      <div className="pc-lead">{poem.lead ? tr(poem.lead) : (poem.rhythm ? tr(poem.rhythm) : tr(poem.collName))}</div>
      <div className="pc-foot">
        <span>{poem.len} 字</span>
        {poem.rhythm && <span className="tag">· {tr(poem.rhythm)}</span>}
        {poem.tags?.includes('唐诗三百首') && <span className="tag">· 三百首</span>}
        {poem.tags?.includes('宋词三百首') && <span className="tag">· 三百首</span>}
      </div>
    </Link>
  );
}
