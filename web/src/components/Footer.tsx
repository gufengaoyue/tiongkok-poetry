import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="foot-top">
          <div>
            <div className="foot-brand">墨澜<small>MOLAN · VERSE ARCHIVE</small></div>
            <p className="foot-note">
              一座中国古典诗词的数字档案。三十四万五千首诗、词、曲与经典，
              从先秦到清代，在这里被重新整理、索引与阅读。
            </p>
          </div>
          <div className="foot-col">
            <h4>浏览</h4>
            <Link to="/library">诗库 · Library</Link>
            <Link to="/poets">诗人 · Poets</Link>
            <Link to="/atlas">图谱 · Atlas</Link>
            <Link to="/classics">典籍 · Classics</Link>
          </div>
          <div className="foot-col">
            <h4>数据</h4>
            <p>12 部总集 · 345,386 首</p>
            <p>13,733 位诗人 · 21,834,450 字</p>
            <p>原始数据来源：<a className="foot-inline" href="https://github.com/chinese-poetry/chinese-poetry" target="_blank" rel="noreferrer">chinese-poetry ↗</a></p>
            <p>许可协议：MIT</p>
          </div>
          <div className="foot-col">
            <h4>关于</h4>
            <Link to="/about">数据与方法</Link>
            <a href="https://github.com/gufengaoyue/chinese-poetry" target="_blank" rel="noreferrer">GitHub 仓库 ↗</a>
            <p>React · Vite · Node.js</p>
            <p>本地静态构建，无追踪</p>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 墨澜 · 本站为古典诗词数据可视化与检索演示</span>
          <span>诗者，志之所之也 · 在心为志，发言为诗</span>
        </div>
      </div>
    </footer>
  );
}
