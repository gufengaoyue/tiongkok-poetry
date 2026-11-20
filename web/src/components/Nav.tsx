import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useScrolled } from '../hooks';
import { useLang } from '../lang';
import { applyTheme, getStoredTheme, type Theme } from '../theme';
import { Icon } from './Icon';

const links = [
  { to: '/', label: '首页', en: 'HOME', end: true },
  { to: '/library', label: '诗库', en: 'LIBRARY' },
  { to: '/poets', label: '诗人', en: 'POETS' },
  { to: '/atlas', label: '图谱', en: 'ATLAS' },
  { to: '/classics', label: '典籍', en: 'CLASSICS' },
  { to: '/favorites', label: '收藏', en: 'FAVORITES' },
];

function ThemeSwitch({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="theme-toggle" aria-label="页面风格" role="group">
      <button type="button" className={theme === 'ink' ? 'on' : ''} aria-pressed={theme === 'ink'}
        title="墨金风格" onClick={() => onChange('ink')}>墨金</button>
      <button type="button" className={theme === 'paper' ? 'on' : ''} aria-pressed={theme === 'paper'}
        title="米白风格" onClick={() => onChange('paper')}>米白</button>
    </div>
  );
}

export function Nav({ onSearch }: { onSearch: () => void }) {
  const scrolled = useScrolled(30);
  const loc = useLocation();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  const setTheme = (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
  };

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
            <ThemeSwitch theme={theme} onChange={setTheme} />
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
            <div className="sheet-setting">
              <span className="mono sheet-setting-label">页面风格</span>
              <ThemeSwitch theme={theme} onChange={setTheme} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
