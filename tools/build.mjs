// Builds the static MedTech user manuals site from content/<lang>/<manual>.md and shots/<lang>/<manual>/*.{png,json}.
//
//   node tools/build.mjs
//
// Output (committed, served as-is by GitHub Pages): index.html, en/*.html, ar/*.html. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'ar'];
const MANUALS = ['operator', 'coordinator', 'doctor', 'pharmacy', 'admin', 'patient-app'];

const UI = {
  en: {
    site: 'MedTech user manuals', manuals: 'Manuals', contents: 'On this page', other: 'العربية', otherLang: 'ar',
    soon: 'Screenshot coming soon', enlarge: 'Click the screenshot to enlarge it.', back: 'All manuals',
    footer: 'Screenshots show demonstration data, never real patients.', open: 'Open manual', updated: 'Updated',
    intro: 'Step-by-step guides for every part of the MedTech platform. Choose the guide for the portal or app you use.',
    note: 'Note', warn: 'Important', tip: 'Tip', marker: 'Marker',
  },
  ar: {
    site: 'أدلة استخدام MedTech', manuals: 'الأدلة', contents: 'في هذه الصفحة', other: 'English', otherLang: 'en',
    soon: 'الصورة قريبًا', enlarge: 'اضغط على الصورة لتكبيرها.', back: 'كل الأدلة',
    footer: 'الصور تعرض بيانات تجريبية، ولا تعرض مرضى حقيقيين أبدًا.', open: 'افتح الدليل', updated: 'آخر تحديث',
    intro: 'أدلة خطوة بخطوة لكل جزء من منصة MedTech. اختر الدليل الخاص بالبوابة أو التطبيق الذي تستخدمه.',
    note: 'ملاحظة', warn: 'مهم', tip: 'نصيحة', marker: 'علامة',
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/(^|[^*\w])\*([^*\s](?:[^*]*?[^*\s])?)\*(?![*\w])/g, '$1<em>$2</em>');
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
  return s;
}

function slug(text, used) {
  const base = text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '') || 's';
  let s = base, n = 2;
  while (used.has(s)) s = `${base}-${n++}`;
  used.add(s);
  return s;
}

function frontMatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(src);
  const meta = {};
  if (!m) return [meta, src];
  for (const line of m[1].split('\n')) {
    const k = line.indexOf(':');
    if (k > 0) meta[line.slice(0, k).trim()] = line.slice(k + 1).trim();
  }
  return [meta, src.slice(m[0].length)];
}

const LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

function list(items) {
  let idx = 0;
  function walk(level) {
    const tag = items[idx].ordered ? 'ol' : 'ul';
    let s = `<${tag}>`;
    while (idx < items.length && items[idx].indent >= level) {
      const it = items[idx];
      if (it.indent > level) { s = s.replace(/<\/li>$/, '') + walk(it.indent) + '</li>'; continue; }
      s += `<li>${inline(it.text)}</li>`;
      idx++;
    }
    return `${s}</${tag}>`;
  }
  let html = '';
  while (idx < items.length) html += walk(items[idx].indent);
  return html;
}

function figure(lang, manual, name, caption, callouts, shotId, defaultDevice) {
  const ui = UI[lang];
  const dir = path.join(root, 'shots', lang, manual);
  const metaFile = path.join(dir, `${name}.json`);
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
  const device = meta?.device ?? defaultDevice ?? 'desktop';
  const markers = meta
    ? callouts.map((_, i) => {
        const m = meta.markers?.[String(i + 1)];
        return m ? `<button class="marker" type="button" style="--x:${m.x}%;--y:${m.y}%" data-id="${shotId}-${i + 1}">${i + 1}</button>` : '';
      }).join('')
    : '';
  const img = meta
    ? `<img src="../shots/${lang}/${manual}/${meta.image}" width="${meta.width}" height="${meta.height}" alt="${esc(caption)}" loading="lazy">`
    : `<div class="placeholder" role="img" aria-label="${esc(ui.soon)}"><span>${esc(ui.soon)}</span><small>${esc(name)}.png</small></div>`;
  const items = callouts.map((c, i) => `<li data-id="${shotId}-${i + 1}"><span class="num">${i + 1}</span><span>${inline(c)}</span></li>`).join('');
  return `<figure class="shot shot-${device}${meta ? '' : ' shot-missing'}">
  <div class="screenshot">${img}${markers}</div>
  <div class="shot-text">${caption ? `<figcaption>${inline(caption)}</figcaption>` : ''}${items ? `<ol class="callouts">${items}</ol>` : ''}</div>
</figure>`;
}

function render(lang, manual, src) {
  const ui = UI[lang];
  const [meta, body] = frontMatter(src.replace(/\r/g, ''));
  const lines = body.split('\n');
  const out = [];
  const toc = [];
  const used = new Set();
  let i = 0, shotNo = 0, open = false;
  const blockStart = (l) => !l.trim() || /^#{2,4}\s/.test(l) || l.startsWith('::') || l.startsWith('>') || /^\|/.test(l) || LIST_RE.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{2,4})\s+(.*)$/.exec(l);
    if (h) {
      const level = h[1].length, text = h[2].trim(), id = slug(text, used);
      if (level === 2) {
        if (open) out.push('</section>');
        out.push(`<section id="${id}" class="fade-in"><h2>${inline(text)}</h2>`);
        open = true;
      } else {
        out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      }
      if (level <= 3) toc.push({ level, text, id });
      i++; continue;
    }
    if (l.startsWith('::shot ')) {
      const [name, caption = ''] = l.slice(7).split('|').map((s) => s.trim());
      i++;
      const callouts = [];
      while (i < lines.length && !lines[i].trim()) i++;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) callouts.push(lines[i++].replace(/^\d+\.\s+/, ''));
      shotNo++;
      out.push(figure(lang, manual, name, caption, callouts, `s${shotNo}`, meta.device));
      continue;
    }
    if (l.startsWith('>')) {
      const q = [];
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''));
      let text = q.join(' ');
      let kind = 'note';
      const m = /^\[!(note|warn|tip)\]\s*/i.exec(text);
      if (m) { kind = m[1].toLowerCase(); text = text.slice(m[0].length); }
      out.push(`<aside class="callout-box ${kind}"><strong>${esc(ui[kind])}</strong> ${inline(text)}</aside>`);
      continue;
    }
    if (/^\|/.test(l) && lines[i + 1] && /^\|\s*:?-{3,}/.test(lines[i + 1])) {
      const row = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(l);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(row(lines[i++]));
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (LIST_RE.test(l)) {
      const items = [];
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (!m) break;
        items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] });
        i++;
      }
      out.push(list(items));
      continue;
    }
    const para = [];
    while (i < lines.length && !(para.length && blockStart(lines[i]))) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  if (open) out.push('</section>');
  return { meta, html: out.join('\n'), toc };
}

function shell(lang, { title, description, body, nav, current, otherHref }) {
  const ui = UI[lang];
  const manualsMenu = MANUALS.map((m) => {
    const meta = metaOf(lang, m);
    return meta ? `<a href="${m}.html"${m === current ? ' aria-current="page"' : ''}>${esc(meta.short ?? meta.title)}</a>` : '';
  }).join('');
  return `<!doctype html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/manual.css">
</head>
<body>
<header class="topbar">
  <button class="menu-toggle" type="button" aria-label="${esc(ui.contents)}" aria-expanded="false">☰</button>
  <a class="brand" href="index.html"><span class="logo" aria-hidden="true">M</span><span>${esc(ui.site)}</span></a>
  <nav class="manuals" aria-label="${esc(ui.manuals)}">${manualsMenu}</nav>
  <a class="lang" href="${otherHref}" hreflang="${ui.otherLang}" lang="${ui.otherLang}">${esc(ui.other)}</a>
</header>
<div class="layout">
${nav ? `<aside class="sidebar"><nav aria-label="${esc(ui.contents)}"><p class="sidebar-title">${esc(ui.contents)}</p>${nav}</nav></aside>` : ''}
<main>
${body}
<footer class="foot">${esc(ui.footer)}</footer>
</main>
</div>
<div class="lightbox" hidden><img alt=""></div>
<button class="lightbox-close" type="button" hidden aria-label="Close">×</button>
<script src="../assets/manual.js"></script>
</body>
</html>`;
}

const metaCache = {};
function metaOf(lang, manual) {
  const key = `${lang}/${manual}`;
  if (!(key in metaCache)) {
    const f = path.join(root, 'content', lang, `${manual}.md`);
    metaCache[key] = fs.existsSync(f) ? frontMatter(fs.readFileSync(f, 'utf8').replace(/\r/g, ''))[0] : null;
  }
  return metaCache[key];
}

let pages = 0;
for (const lang of LANGS) {
  const ui = UI[lang];
  const outDir = path.join(root, lang);
  fs.mkdirSync(outDir, { recursive: true });
  const cards = [];
  for (const manual of MANUALS) {
    const f = path.join(root, 'content', lang, `${manual}.md`);
    if (!fs.existsSync(f)) continue;
    const { meta, html, toc } = render(lang, manual, fs.readFileSync(f, 'utf8'));
    const nav = `<ul>${toc.map((t) => `<li class="l${t.level}"><a href="#${t.id}">${inline(t.text)}</a></li>`).join('')}</ul>`;
    const hero = `<div class="hero"><p class="kicker">${esc(meta.portal ?? '')}</p><h1>${esc(meta.title)}</h1><p class="lead">${inline(meta.lead ?? '')}</p>${meta.audience ? `<p class="audience">${inline(meta.audience)}</p>` : ''}<p class="hint">${esc(ui.enlarge)}</p></div>`;
    fs.writeFileSync(path.join(outDir, `${manual}.html`), shell(lang, {
      title: `${meta.title} · ${ui.site}`, description: meta.lead ?? '', body: hero + html, nav, current: manual,
      otherHref: `../${ui.otherLang}/${manual}.html`,
    }));
    pages++;
    cards.push(`<a class="card" href="${manual}.html"><span class="kicker">${esc(meta.portal ?? '')}</span><strong>${esc(meta.title)}</strong><span>${inline(meta.audience ?? '')}</span><span class="go">${esc(ui.open)} →</span></a>`);
  }
  fs.writeFileSync(path.join(outDir, 'index.html'), shell(lang, {
    title: ui.site, description: ui.intro,
    body: `<div class="hero"><h1>${esc(ui.site)}</h1><p class="lead">${esc(ui.intro)}</p></div><div class="cards">${cards.join('')}</div>`,
    nav: '', current: null, otherHref: `../${ui.otherLang}/index.html`,
  }));
  pages++;
}

// Root: send readers to their language, defaulting to English.
fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>MedTech user manuals</title><link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<script>location.replace(((navigator.languages || [navigator.language || 'en'])[0] || 'en').toLowerCase().startsWith('ar') ? 'ar/' : 'en/');</script>
<link rel="stylesheet" href="assets/manual.css"></head>
<body><main class="root-pick"><h1>MedTech user manuals · أدلة استخدام MedTech</h1>
<p><a href="en/">English</a> · <a href="ar/">العربية</a></p></main></body></html>`);
console.log(`built ${pages + 1} pages`);
