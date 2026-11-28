// 用本地 tailwindcss (v4) 把站点用到的工具类编译成 css/tailwind.local.css，替代 cdn.tailwindcss.com。
// 用法: node tools/build-tailwind.mjs   （需要 `npm i tailwindcss`；默认从 ./node_modules 或环境变量 TW_DIR 解析）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TW_DIR = process.env.TW_DIR || path.join(ROOT, 'node_modules', 'tailwindcss');
const { compile } = await import(pathToFileURL(path.join(TW_DIR, 'dist', 'lib.mjs')).href);

/* 1) 收集候选类名：html / js 里出现的所有 token（Tailwind 只会为合法类生成 CSS） */
const exts = new Set(['.html', '.js']);
const skip = new Set(['node_modules', 'tests', 'tools', '.git']);
const tokens = new Set();
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (exts.has(path.extname(f.name))) {
      for (const t of fs.readFileSync(p, 'utf8').split(/[\s"'`<>=;{}]+/)) if (t && t.length < 120) tokens.add(t);
    }
  }
})(ROOT);

/* 2) 编译（样式表按 npm 包路径解析） */
const input = `@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities);`;
const compiler = await compile(input, {
  base: ROOT,
  loadStylesheet: async (id, base) => {
    const rel = id.startsWith('tailwindcss/') ? id.slice('tailwindcss/'.length) : id === 'tailwindcss' ? 'index.css' : null;
    if (!rel) throw new Error('unsupported import ' + id);
    const file = path.join(TW_DIR, rel);
    return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
  },
});
let css = compiler.build([...tokens]);

/* 3) 对齐 CDN(v3) 的行为：去掉 @layer 包装（与原先 CDN 注入的无层样式同级，放在 style.css 之后加载）+ v3 默认值 */
css = css.replace(/@layer\s+(theme|base|utilities|properties)\s*\{/g, '@media all {');
css += `
/* ---- v3 兼容 ---- */
*,::before,::after{border-color:#e5e7eb}
button:not(:disabled),[role=button]:not(:disabled){cursor:pointer}
input::placeholder,textarea::placeholder{color:#9ca3af}
`;
fs.writeFileSync(path.join(ROOT, 'css', 'tailwind.local.css'), css);
console.log('tailwind.local.css', (css.length / 1024).toFixed(1) + ' KB,', tokens.size, 'candidates');
