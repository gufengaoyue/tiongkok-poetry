import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useDebounce } from '../hooks';
import { useLang } from '../lang';
import { Icon } from './Icon';

const CHIPS = ['李白', '苏轼', '明月', '春风', '相思', '江南', '酒', '雪'];

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 280);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { tr } = useLang();

  const { data } = useApi<any>('/search', { q: dq, size: 6 }, open && dq.trim().length > 0);
  const { data: poets } = useApi<any>('/poets', { q: dq, size: 4, sort: 'count' }, open && dq.trim().length > 0);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
      setQ('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = () => {
    if (!q.trim()) return;
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ov-panel">
        <div className="ov-top">
          {Icon.search({})}
          <input
            ref={inputRef}
            value={q}
            placeholder="搜索诗题、诗人或任意一句诗…"
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') go(); }}
          />
          <span className="ov-hint">ESC 关闭</span>
        </div>

        {!q && (
          <div className="ov-chips">
            {CHIPS.map(c => (
              <button key={c} className="chip" onClick={() => setQ(c)}>{c}</button>
            ))}
            <button className="chip" onClick={() => navigate('/atlas')}>飞花令 ↗</button>
          </div>
        )}

        {q && (
          <div className="ov-list">
            {poets?.items?.length > 0 && (
              <>
                <div className="ov-hint" style={{ marginTop: 20, marginBottom: 6 }}>诗人</div>
                {poets.items.map((p: any) => (
                  <div key={p.id} className="ov-item"
                    onClick={() => { navigate(`/poet/${p.id}`); onClose(); }}
                    style={{ cursor: 'pointer' }}>
                    <span className="t">{tr(p.name)}</span>
                    <span className="a">{p.dynasty} · {p.poemCount} 首</span>
                  </div>
                ))}
              </>
            )}
            {data?.items?.length > 0 && (
              <>
                <div className="ov-hint" style={{ marginTop: 20, marginBottom: 6 }}>诗句 · 共 {data.total.toLocaleString()} 条</div>
                {data.items.map((p: any) => (
                  <div key={p.id} className="ov-item"
                    onClick={() => { navigate(`/poem/${p.id}`); onClose(); }}
                    style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                    <span className="t">{tr(p.title)}</span>
                    <span className="a">{tr(p.author)} · {p.dynasty}</span>
                    <span className="b">{p.collName}</span>
                  </div>
                ))}
                <div className="ov-item" style={{ cursor: 'pointer', justifyContent: 'center' }} onClick={go}>
                  <span className="a">查看全部结果 →</span>
                </div>
              </>
            )}
            {!data?.items?.length && !poets?.items?.length && (
              <div className="empty" style={{ padding: '50px 0' }}>没有找到「{q}」相关的诗句</div>
            )}
          </div>
        )}

        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)' }}>
          <span className="ov-hint">墨澜全文检索 · 34.5 万首</span>
          <button className="ov-hint" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            关闭 {Icon.close({})}
          </button>
        </div>
      </div>
    </div>
  );
}
