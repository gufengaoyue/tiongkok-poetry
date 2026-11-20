/**
 * GitHub Pages 收尾：SPA 404 回退 + 关闭 Jekyll。
 * 站点按项目页部署：https://gufengaoyue.github.io/chinese-poetry/
 */
const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'web', 'dist-pages');
const index = path.join(dist, 'index.html');
if (!fs.existsSync(index)) {
  console.error(`缺少 ${index}，请先运行 npm run build:pages。`);
  process.exit(1);
}

fs.copyFileSync(index, path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('GitHub Pages 收尾完成：404.html / .nojekyll');
