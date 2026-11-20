import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useScrolled } from '../hooks';
import { useLang } from '../lang';
import { Icon } from './Icon';

const links = [
  { to: '/', label: '首页', en: 'HOME', end: true },
  { to: '/library', label: '诗库', en: 'LIBRARY' },
  { to: '/poets', label: '诗人', en: 'POETS' },
  { to: '/atlas', label: '图谱', en: 'ATLAS' },
  { to: '/classics', label: '典籍', en: 'CLASSICS' },
];

export function Nav({ onSearch }: { onSearch: () => void }) {
  const scrolled = useScrolled(30);
  const loc = useLocation();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (to: string, end?: boolean) => {
    if (end) return loc.pathname === to;
    if (to === '/library') return loc.pathname.startsWith('/library') || loc.pathname.startsWith('/poem');
    if (to === '/poets') return loc.pathname.startsWith('/poet');
    return loc.pathname.startsWith(to);
  };

  return (
    <>
      <nav className={`nav ${scrolled || open ? 'scrolled' : ''}`}>
        <div className="nav-inner">
          <Link className="brand" to="/">
            <div className="brand-seal">墨</div>
            <div className="brand-text">
              <div className="brand-name">墨澜</div>
              <div className="brand-en">MOLAN · VERSE ARCHIVE</div>
            </div>
          </Link>

          <div className="nav-links">
            {links.map(l => (
              <Link key={l.to} to={l.to}
                className={`nav-link ${isActive(l.to, l.end) ? 'active' : ''}`}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className="nav-right">
            <button className="icon-btn" onClick={onSearch} aria-label="全文检索" title="检索 ⌘K">
              {Icon.search({})}
            </button>
            <div className="lang-toggle" aria-label="简繁切换">
              <button className={lang === 's' ? 'on' : ''} onClick={() => setLang('s')}>简</button>
              <button className={lang === 't' ? 'on' : ''} onClick={() => setLang('t')}>繁</button>
            </div>
            <button className={`icon-btn menu-btn ${open ? 'on' : ''}`} aria-label="导航菜单"
              aria-expanded={open} onClick={() => setOpen(v => !v)}>
              {open ? Icon.close({}) : Icon.menu({})}
            </button>
          </div>
        </div>
      </nav>

      {open && (
        <div className="nav-sheet">
          <div className="nav-sheet-inner">
            {links.map((l, i) => (
              <Link key={l.to} to={l.to} className={isActive(l.to, l.end) ? 'active' : ''}>
                <span className="ns-index mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="ns-label">{l.label}</span>
                <span className="ns-en mono">{l.en}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
