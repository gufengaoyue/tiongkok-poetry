import { Link } from 'react-router-dom';
import { useApi } from '../hooks';
import type { Stats } from '../types';

export function About() {
  const { data: s } = useApi<Stats>('/stats');
  return (
    <main className="page">
      <div className="shell" style={{ paddingTop: 96, maxWidth: 980 }}>
        <div className="kicker"><span className="dot" />ABOUT · 关于</div>
        <h1 className="search-title" style={{ marginTop: 20 }}>数据与方法</h1>
        <p className="lede" style={{ maxWidth: 720 }}>
          墨澜不是凭空的创作，而是对一个开源诗词数据库的重新组织与再设计。
          每一首诗都来自 chinese-poetry 项目，本站只做清洗、索引与呈现。
        </p>

        <div className="atlas-grid" style={{ marginTop: 60 }}>
          <div className="panel half">
            <div className="panel-head"><span className="panel-title">数据规模</span><span className="panel-label">CORPUS</span></div>
            <div className="bar-list">
              {[
                ['诗词作品', s?.totals.poems ?? 0],
                ['诗人', s?.totals.authors ?? 0],
                ['总行数', s?.totals.lines ?? 0],
                ['总字数', s?.totals.chars ?? 0],
                ['词牌', s?.totals.rhythms ?? 0],
              ].map(([k, v], i) => (
                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{k}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--gold-2)' }}>{(v as number).toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel half">
            <div className="panel-head"><span className="panel-title">处理流程</span><span className="panel-label">PIPELINE</span></div>
            <div className="aside-body" style={{ lineHeight: 2.05 }}>
              <p>1 · 解析 12 部总集、14 部典籍的原始 JSON。</p>
              <p>2 · 统一繁简、清洗空白与重复，生成紧凑 TSV 语料。</p>
              <p>3 · 合并诗人档案（唐诗 3,675 位 / 宋诗 8,934 位 / 词人 1,563 位）。</p>
              <p>4 · 关联网络热度（百度、Google、Bing 等检索量），用于「热门」排序。</p>
              <p>5 · 统计词牌、字频、意象、篇幅与产量分布。</p>
            </div>
          </div>

          <div className="panel wide">
            <div className="panel-head"><span className="panel-title">技术栈</span><span className="panel-label">STACK</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              {[
                ['前端', 'React 18 · TypeScript · Vite'],
                ['样式', '手写设计系统 · 自定义字形子集'],
                ['服务', 'Node.js 内置 http，零第三方依赖'],
                ['数据', 'Python 预处理 · 紧凑 TSV · 内存索引'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="mono" style={{ color: 'var(--gold-3)', marginBottom: 8 }}>{k}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.9 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel wide">
            <div className="panel-head"><span className="panel-title">数据来源与许可</span><span className="panel-label">SOURCE</span></div>
            <div className="aside-body" style={{ lineHeight: 2 }}>
              原始数据来自开源项目 <a href="https://github.com/chinese-poetry/chinese-poetry" target="_blank" rel="noreferrer" style={{ color: 'var(--gold-2)' }}>chinese-poetry</a>（MIT License）。
              包含全唐诗、全宋诗、全宋词、元曲、诗经、楚辞、花间集、南唐二主词、千家诗、水墨唐诗、纳兰词、曹操诗集等。
              本站仅用于学习与展示，诗文的版权与校勘归原作者与整理者所有。
            </div>
          </div>
        </div>

        <div style={{ marginTop: 60, display: 'flex', gap: 14 }}>
          <Link className="btn" to="/library">进入诗库<span className="arrow">→</span></Link>
          <Link className="btn ghost" to="/atlas">查看图谱</Link>
        </div>
      </div>
    </main>
  );
}
