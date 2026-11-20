import { Link, useParams } from 'react-router-dom';
import { useApi } from '../hooks';
import { useLang } from '../lang';
import type { ClassicBook } from '../types';

export function Classics() {
  const { data } = useApi<any>('/classics');
  const { tr } = useLang();
  return (
    <main className="page">
      <div className="shell" style={{ paddingTop: 84 }}>
        <div className="kicker"><span className="dot" />THE CLASSICS · 典籍</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30, flexWrap: 'wrap' }}>
          <div>
            <h1 className="search-title" style={{ marginTop: 20 }}>诗之外的经典</h1>
            <p className="lede">《论语》《孟子》《大学》《中庸》，与蒙学、家训、小品。它们不是诗，却塑造了读诗的人。</p>
          </div>
          <div className="sec-side" style={{ paddingBottom: 8 }}>{data ? data.books.length : 14} CLASSICS</div>
        </div>

        <div className="books" style={{ marginTop: 54 }}>
          {(data?.books || []).map((b: any, i: number) => (
            <Link key={b.id} to={`/classics/${b.id}`} className="book-card">
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.2em', color: 'var(--text-3)' }}>
                {String(i + 1).padStart(2, '0')} / {b.sections ? `${b.sections} 章` : `${b.items} 则`}
              </div>
              <div className="book-title" style={{ marginTop: 'auto' }}>{tr(b.title)}</div>
              <div className="book-author">{tr(b.author)}</div>
              <div className="book-intro">{tr(b.intro)}</div>
              <div className="book-meta">READ →</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export function ClassicPage() {
  const { id } = useParams();
  const { data: b, error } = useApi<ClassicBook>(`/classics/${id}`, undefined, !!id);
  const { tr } = useLang();

  if (error) return <main className="page"><div className="shell" style={{ paddingTop: 120 }}>
    <div className="error-box">没有找到这部典籍。<Link className="back-link" to="/classics">← 返回典籍</Link></div>
  </div></main>;
  if (!b) return <main className="page"><div className="shell" style={{ paddingTop: 160 }}><div className="spin-loader" /></div></main>;

  return (
    <main className="page">
      <div className="shell">
        <div className="reader">
          <aside className="reader-nav">
            <div style={{ marginBottom: 16 }}>
              <Link to="/classics" className="back-link">← 典籍</Link>
            </div>
            {b.sections?.length > 0 ? b.sections.map((s, i) => (
              <a key={i} href={`#s-${i}`}>{tr(s.title) || `第 ${i + 1} 章`}</a>
            )) : <div className="mono" style={{ color: 'var(--text-3)' }}>{b.items?.length} 则</div>}
          </aside>

          <div>
            <div className="reader-head">
              <div className="kicker"><span className="dot" />CLASSIC · {b.sections?.length ? `${b.sections.length} CHAPTERS` : `${b.items?.length} NOTES`}</div>
              <h1 className="reader-title" style={{ marginTop: 18 }}>{tr(b.title)}</h1>
              <div style={{ fontSize: 12, color: 'var(--gold-3)', marginTop: 10, letterSpacing: '.1em' }}>{tr(b.author)}</div>
              <p className="reader-intro">{tr(b.intro)}</p>
            </div>

            {b.sections?.length > 0 && b.sections.map((s, i) => (
              <section className="reader-section" id={`s-${i}`} key={i}>
                <h3>{tr(s.title) || `第 ${i + 1} 章`}</h3>
                {s.paragraphs.map((p, j) => <p className="reader-p" key={j}>{tr(p)}</p>)}
              </section>
            ))}

            {(b.items?.length ?? 0) > 0 && (
              <div>
                {b.items!.map((it, i) => (
                  <div className="aphorism" key={i}>
                    <p>{tr(it.text)}</p>
                    {it.comments?.map((c, j) => <div className="cmt" key={j}>{tr(c)}</div>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
