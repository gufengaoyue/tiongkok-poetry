import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Lang = 's' | 't';

interface S2T { chars: Record<string, string>; phrases: Record<string, string>; }

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: (s: string) => string;
  ready: boolean;
}

const Ctx = createContext<LangCtx>({ lang: 's', setLang: () => {}, tr: s => s, ready: true });

const PHRASE_MAX = 8;

function convert(text: string, map: S2T | null): string {
  if (!map || !text) return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    let hit = false;
    const limit = Math.min(PHRASE_MAX, text.length - i);
    for (let L = limit; L >= 2; L--) {
      const sub = text.slice(i, i + L);
      const r = map.phrases[sub];
      if (r) { out += r; i += L; hit = true; break; }
    }
    if (!hit) {
      const ch = text[i];
      out += map.chars[ch] || ch;
      i += 1;
    }
  }
  return out;
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('molan-lang') as Lang) || 's'; } catch { return 's'; }
  });
  const [map, setMap] = useState<S2T | null>(null);
  const [loading, setLoading] = useState(false);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('molan-lang', l); } catch {}
  }, []);

  useEffect(() => {
    if (lang !== 't' || map) return;
    setLoading(true);
    fetch('/api/s2t').then(r => r.json()).then(d => { setMap(d); setLoading(false); }).catch(() => setLoading(false));
  }, [lang, map]);

  const tr = useCallback((s: string) => (lang === 't' ? convert(s, map) : s), [lang, map]);

  const value = useMemo(() => ({ lang, setLang, tr, ready: !loading }), [lang, setLang, tr, loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
