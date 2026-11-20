import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { LangProvider } from './lang';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { SearchOverlay } from './components/SearchOverlay';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { PoemPage } from './pages/PoemPage';
import { Poets } from './pages/Poets';
import { PoetPage } from './pages/PoetPage';
import { Atlas } from './pages/Atlas';
import { SearchPage } from './pages/SearchPage';
import { Classics, ClassicPage } from './pages/Classics';
import { About } from './pages/About';
import { Favorites } from './pages/Favorites';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as any }); }, [pathname]);
  return null;
}

export default function App() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <LangProvider>
      <ScrollTop />
      <Nav onSearch={() => setOpen(true)} />
      <SearchOverlay open={open} onClose={() => setOpen(false)} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/library" element={<Library />} />
        <Route path="/poem/:id" element={<PoemPage />} />
        <Route path="/poets" element={<Poets />} />
        <Route path="/poet/:id" element={<PoetPage />} />
        <Route path="/atlas" element={<Atlas />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/classics" element={<Classics />} />
        <Route path="/classics/:id" element={<ClassicPage />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={
          <main className="page"><div className="shell" style={{ paddingTop: 140, textAlign: 'center' }}>
            <div className="kicker" style={{ justifyContent: 'center' }}><span className="dot" />404</div>
            <h1 className="search-title" style={{ marginTop: 20 }}>此页无诗</h1>
            <p className="lede" style={{ margin: '20px auto 0' }}>你走进了一条没有诗句的巷子。</p>
            <div style={{ marginTop: 34 }}><Link className="btn" to="/">回到首页<span className="arrow">→</span></Link></div>
          </div></main>
        } />
      </Routes>
      <Footer />
    </LangProvider>
  );
}
