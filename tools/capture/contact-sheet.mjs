// One image with every screenshot of a manual and its markers, for a quick review after a capture run.
//   MEDTECH_FRONTEND=<checkout> node tools/capture/contact-sheet.mjs <lang> <manual> [out.png]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [lang = 'en', manual = 'pharmacy', out = path.join(ROOT, 'shots', `_sheet-${lang}-${manual}.png`)] = process.argv.slice(2);
const { chromium } = createRequire(path.join(process.env.MEDTECH_FRONTEND, 'package.json'))('@playwright/test');

const dir = path.join(ROOT, 'shots', lang, manual);
const metas = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const phone = metas[0]?.device === 'phone';
const cell = phone ? 230 : 440;
const cells = metas.map((m) => {
  const img = `data:image/png;base64,${fs.readFileSync(path.join(dir, m.image)).toString('base64')}`;
  const marks = Object.entries(m.markers).map(([n, p]) =>
    `<b style="left:${p.x}%;top:${p.y}%">${n}</b>`).join('');
  return `<figure><figcaption>${m.image}</figcaption><div><img src="${img}">${marks}</div></figure>`;
}).join('');
const css = `body{margin:0;font:12px system-ui;background:#f2f4f7}figure{display:inline-block;width:${cell}px;margin:6px;vertical-align:top}
div{position:relative}img{width:100%;display:block;border:1px solid #c9ced6}
b{position:absolute;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#1f5fc8;color:#fff;
font:700 10px/18px system-ui;text-align:center;outline:2px solid #fff}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: phone ? 1500 : 1400, height: 900 } });
await page.setContent(`<style>${css}</style>${cells}`);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
