// 统一版本号 + 生成 Service Worker 预缓存清单。
// 用法: node tools/build.mjs        （版本号只在 version.json 里改一处）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const VERSION = CFG.version;
const SITE = String(CFG.siteUrl || 'https://example.com/').replace(/\/?$/, '/');   // 域名只在 version.json 里改一处
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);
let changed = [];

function patch(file, fn) {
  const before = rd(file), after = fn(before);
  if (before !== after) { wr(file, after); changed.push(file); }
}

/* 1) 所有 ?v=x.y.z 统一成 version.json 的版本（load.html + 各 loader） */
patch('load.html', (s) => s.replace(/\?v=[0-9.]+/g, '?v=' + VERSION));
patch('js/home/core/osu-loader.js', (s) => s.replace(/\?v=[0-9.]+/g, '?v=' + VERSION));
patch('js/home/core/gamehub-loader.js', (s) => s.replace(/\?v=[0-9.]+/g, '?v=' + VERSION));
patch('js/home/core/celeste-loader.js', (s) => s.replace(/var VER = '\?v=[0-9.]+'/, "var VER = '?v=" + VERSION + "'"));
patch('html/home/home.html', (s) => s.replace(/KERNEL_V[0-9.]+_OS/, 'KERNEL_V' + VERSION + '_OS'));
patch('package.json', (s) => s.replace(/("version":\s*")[0-9.]+(")/, '$1' + VERSION + '$2'));

/* 1b) SEO / 分享：域名、成就数量与代码保持一致；robots.txt + sitemap.xml 由域名生成 */
const achCount = (rd('js/home/core/achievements.js').match(/\bid:\s*'/g) || []).length;
for (const f of ['index.html', 'load.html']) {
  patch(f, (s) => s
    .replace(/(<meta property="og:url" content=")[^"]*(")/, '$1' + SITE + '$2')
    .replace(/(<link rel="canonical" href=")[^"]*(")/, '$1' + SITE + '$2')
    .replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*(")/g, '$1' + SITE + 'assets/og.png$2')
    .replace(/\d+ 项成就/g, achCount + ' 项成就'));
}
function writeIfChanged(file, text) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) { fs.writeFileSync(p, text); changed.push(file); }
}
writeIfChanged('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE + 'sitemap.xml\n');
writeIfChanged('sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  '  <url><loc>' + SITE + '</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n' +
  '  <url><loc>' + SITE + 'wiki.html</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n</urlset>\n');

/* 2) 预缓存清单：全站静态文件（不含测试 / 工具 / 文档 / 构建产物） */
const skipDir = new Set(['node_modules', 'tests', 'tools', '.git', '.github']);
const skipFile = new Set(['sw.js', 'version.json', 'robots.txt', 'sitemap.xml', 'package.json', 'package-lock.json', 'README.txt', 'FIXES.txt', 'CHANGELOG.txt', '.gitignore']);
const core = ['./'];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (skipDir.has(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (!skipFile.has(f.name) && !f.name.endsWith('.md')) core.push('./' + path.relative(ROOT, p).split(path.sep).join('/'));
  }
})(ROOT);

const sw = rd('tools/sw.template.js')
  .replace('__CACHE__', 'lzx-v' + VERSION)
  .replace('__CORE__', JSON.stringify(core, null, 2));
if (!fs.existsSync(path.join(ROOT, 'sw.js')) || rd('sw.js') !== sw) { wr('sw.js', sw); changed.push('sw.js'); }

console.log('version', VERSION, '| precache', core.length, 'files | updated:', changed.join(', ') || '(none)');
