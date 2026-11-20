/**
 * 把运行期需要的 JSON 复制进 web/public/data，供 Cloudflare Worker 以静态资源读取。
 * 本地 Node 服务仍直接读取 server/data，不受影响。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'server', 'data');
const dst = path.join(root, 'web', 'public', 'data');

fs.mkdirSync(dst, { recursive: true });
for (const name of ['stats.json', 'classics.json', 's2t.json']) {
  const from = path.join(src, name);
  if (!fs.existsSync(from)) {
    console.error(`缺少 ${from}，请先运行数据管线。`);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(dst, name));
  const kb = (fs.statSync(from).size / 1024).toFixed(0);
  console.log(`  data/${name}  ${kb} KB`);
}
console.log('Cloudflare 静态数据已准备完成。');
