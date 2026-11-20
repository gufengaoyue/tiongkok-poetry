import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { PoemCard } from '../components/PoemCard';
import { loadFavs, removeFav, saveFavs } from '../favorites';
import type { PoemBrief, PoemDetail } from '../types';

export function Favorites() {
  const [ids, setIds] = useState<string[]>(() => loadFavs());
  const [items, setItems] = useState<PoemBrief[]>([]);
  const [loading, setLoading] = useState(ids.length > 0);

  useEffect(() => {
    let alive = true;
    setLoading(ids.length > 0);
    Promise.all(ids.map(id => api<PoemDetail>(`/poem/${id}`).catch(() => null)))
      .then(list => {
        if (!alive) return;
        setItems(list.filter((x): x is PoemDetail => !!x));
        setLoading(false);
      });
    return () => { alive = false; };
  }, [ids]);

  const remove = (id: string) => {
    const next = removeFav(id);
    setIds(next);
    setItems(list => list.filter(x => x.id !== id));
  };

  return (
    <main className="page">
      <div className="shell" style={{ paddingTop: 84 }}>
        <div className="kicker"><span className="dot" />THE COLLECTION · 我的收藏</div>
        <div className="sec-head" style={{ marginTop: 20, marginBottom: 34 }}>
          <div>
            <h1 className="search-title">收藏的诗</h1>
            <p className="lede">收藏保存在这台设备的浏览器里；换设备或清理浏览器数据后不会自动同步。</p>
          </div>
          {ids.length > 0 && <div className="sec-side">{ids.length} SAVED</div>}
        </div>

        {loading ? (
          <div className="lib-grid">
            {ids.map(id => <div key={id} className="skeleton" style={{ height: 250 }} />)}
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="lib-grid">
              {items.map((p, i) => (
                <div className="fav-item" key={p.id}>
                  <PoemCard poem={p} delay={Math.min(i, 12) * 26} />
                  <button className="fav-remove" onClick={() => remove(p.id)} aria-label={`取消收藏 ${p.title}`}>移除</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 34, textAlign: 'center' }}>
              <button className="tool" onClick={() => { saveFavs([]); setIds([]); setItems([]); }}>清空收藏</button>
            </div>
          </>
        ) : (
          <div className="fav-empty" style={{ marginTop: 40 }}>
            <p>还没有收藏。读到喜欢的诗，点一下诗页上的「收藏」。</p>
            <Link className="btn" to="/library" style={{ marginTop: 22 }}>去诗库看看<span className="arrow">→</span></Link>
          </div>
        )}
      </div>
    </main>
  );
}
