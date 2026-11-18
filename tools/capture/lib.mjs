// Screenshot capture for the manuals. Drives a portal running in MOCK mode (demo data only, never live)
// with the medtech-frontend checkout's own Playwright, in English or Arabic, and records where each
// numbered marker belongs so the site can place it exactly.
//
//   MEDTECH_FRONTEND=<path to a medtech-frontend checkout> node tools/capture/<manual>.mjs [en|ar|all]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FRONTEND = process.env.MEDTECH_FRONTEND;
if (!FRONTEND) throw new Error('Set MEDTECH_FRONTEND to a medtech-frontend checkout (main) with dependencies installed.');
const req = createRequire(path.join(FRONTEND, 'package.json'));
const { chromium, devices } = req('@playwright/test');

// ---------------------------------------------------------------- labels in the portal's language
function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}
function catalogue(lang) {
  const dir = path.join(FRONTEND, 'packages', 'i18n', 'src', 'resources', lang);
  const all = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    flatten(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), f.replace(/\.json$/, ''), all);
  }
  return all;
}
const EN = catalogue('en');
const AR = catalogue('ar');
const byEnglish = {};
for (const [k, v] of Object.entries(EN)) (byEnglish[v] ??= []).push(k);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Translator for locators: exact English UI text -> the same text in the capture language. */
function translator(lang) {
  const L = (en) => {
    if (lang === 'en') return en;
    const keys = byEnglish[en];
    const ar = keys?.map((k) => AR[k]).find(Boolean);
    if (!ar) throw new Error(`No Arabic string for UI text: ${JSON.stringify(en)}`);
    return ar;
  };
  /** A RegExp for a catalogue string that contains `part`; {{params}} match anything. */
  L.re = (part) => {
    const entry = Object.entries(EN).find(([, v]) => v.includes(part));
    if (!entry) throw new Error(`No UI string contains ${JSON.stringify(part)}`);
    if (lang === 'en') return new RegExp(escRe(part));
    const ar = AR[entry[0]];
    if (!ar) throw new Error(`No Arabic string for ${entry[0]}`);
    const core = ar.split(/\{\{[^}]+\}\}/).map((x) => x.trim()).filter(Boolean).sort((a, b) => b.length - a.length)[0];
    return new RegExp(escRe(core));
  };
  /** A RegExp for the catalogue string at `key`, with {{params}} matching anything. */
  L.reKey = (key) => {
    const v = (lang === 'en' ? EN : AR)[key];
    if (!v) throw new Error(`No ${lang} string for key ${key}`);
    return new RegExp(v.split(/\{\{[^}]+\}\}/).map(escRe).join('.+?'));
  };
  L.key = (key) => (lang === 'en' ? EN : AR)[key] ?? (() => { throw new Error(`No ${lang} string for key ${key}`); })();
  return L;
}

// ---------------------------------------------------------------- demo pharmacy names
// The portals' demo data names its pharmacies after three real Egyptian chains (El Ezaby, Seif,
// Roshdy). The guides are public, so every capture page shows made-up names instead. Text is swapped
// as the page renders, so markers are placed against what the screenshot shows; typed form values are
// swapped only for the moment of the screenshot and restored (the form must still submit what the
// demo data expects). Arabic needs letter boundaries: «سيف» also sits inside words like «سيفقد».
// The swap is a pure function so it can be passed to the browser as source.
export function demoNamesSwap(s) {
  const A = '[\\p{L}\\p{M}]';
  const word = (w) => new RegExp(`(?<!${A})${w}(?!${A})`, 'gu');
  return s
    .replace(/ph-ezaby/g, 'ph-wadi').replace(/ph-seif/g, 'ph-narges').replace(/ph-roshdy/g, 'ph-yasmin')
    .replace(/\bEl Ezaby\b/g, 'Al Wadi').replace(/\bEzaby\b/g, 'Al Wadi')
    .replace(/\bSeif\b/g, 'Narges').replace(/\bRoshdy\b/g, 'Yasmin')
    .replace(word('العزبي'), 'الوادي').replace(word('سيف'), 'النرجس').replace(word('رشدي'), 'الياسمين');
}
/** Anything the swap missed, for the leftover check before each screenshot. */
const REAL_NAMES = /ezaby|\bseif\b|roshdy|العزبي|(?<![\p{L}\p{M}])سيف(?![\p{L}\p{M}])|رشدي/giu;

const DEMO_NAMES_INIT = `(() => {
  const swap = ${demoNamesSwap.toString()};
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  const fixText = (n) => { const v = swap(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; };
  const fixAttrs = (el) => { for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v) { const w = swap(v); if (w !== v) el.setAttribute(a, w); } } };
  const fixTree = (root) => {
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) fixAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? fixText(n) : fixAttrs(n);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') fixText(r.target);
      else if (r.type === 'attributes') fixAttrs(r.target);
      else r.addedNodes.forEach(fixTree);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.addEventListener('DOMContentLoaded', () => fixTree(document));
})();`;

/** Before a screenshot: swap typed values (kept for the restore) and list any real name left on the page. */
const SWAP_VALUES = `(() => {
  const swap = ${demoNamesSwap.toString()};
  window.__demoNamesRestore = [];
  const fields = [...document.querySelectorAll('input, textarea')];
  for (const el of fields) {
    const v = el.value, w = swap(v);
    if (w !== v) { window.__demoNamesRestore.push([el, v]); el.value = w; }
  }
  const re = new RegExp(${JSON.stringify(REAL_NAMES.source)}, ${JSON.stringify(REAL_NAMES.flags)});
  const text = (document.body ? document.body.innerText : '') + ' ' + fields.map((e) => e.value).join(' ');
  return [...new Set(text.match(re) || [])];
})()`;
/** After the screenshot: put the typed values back, so the form submits what the demo data expects. */
const RESTORE_VALUES = `(() => {
  for (const [el, v] of window.__demoNamesRestore || []) el.value = v;
  window.__demoNamesRestore = [];
})()`;

// ---------------------------------------------------------------- one capture session
export async function session({ manual, port, lang, device = 'desktop', source }) {
  const browser = await chromium.launch();
  const opts = device === 'phone'
    ? { ...devices['Pixel 5'], deviceScaleFactor: 2 }
    : { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1.25 };
  const context = await browser.newContext({ ...opts, locale: lang === 'ar' ? 'ar-EG' : 'en-US', timezoneId: 'Africa/Cairo' });
  await context.addInitScript(DEMO_NAMES_INIT);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const outDir = path.join(ROOT, 'shots', lang, manual);
  fs.mkdirSync(outDir, { recursive: true });
  const L = translator(lang);
  const rtl = lang === 'ar';

  /** The element's box, or for text content the tight box of the text itself. */
  async function boxOf(loc) {
    return loc.first().evaluate((el) => {
      const pick = (r, field = null) => ({ x: r.x, y: r.y, width: r.width, height: r.height, field });
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
        // Which side the typed value sits on: numbers in an Arabic form are often left-aligned.
        const cs = getComputedStyle(el);
        const a = cs.textAlign, ltr = cs.direction === 'ltr';
        let textOn = a === 'left' ? 'left' : a === 'right' ? 'right' : a === 'center' ? 'center'
          : (a === 'end') === ltr ? 'right' : 'left';
        if ((el.getAttribute('dir') === 'auto' || !el.value) && (a === 'start' || a === 'end')) {
          // dir="auto" follows the value's first strong character; a placeholder always lays out by its own.
          const first = ((el.value || el.placeholder || '').match(/[A-Za-z֐-ࣿ]/) ?? [''])[0];
          const rtlText = /[֐-ࣿ]/.test(first);
          textOn = (a === 'start') === rtlText ? 'right' : 'left';
        }
        return pick(el.getBoundingClientRect(), textOn);
      }
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? pick(r) : pick(el.getBoundingClientRect());
    }, null, { timeout: 4000 }).catch(() => null);
  }

  const GAP = 21; // marker centre this far beyond the text, so the circle sits beside it
  async function anchorOf(loc, at, frame) {
    const b = await boxOf(loc);
    if (!b) return null;
    const left = b.x - frame.x, right = b.x + b.width - frame.x, midY = b.y + b.height / 2 - frame.y;
    const fitsLeft = left - GAP >= 15, fitsRight = right + GAP <= frame.w - 15;
    const beforeX = rtl ? right + GAP : left - GAP, afterX = rtl ? left - GAP : right + GAP;
    const beforeFits = rtl ? fitsRight : fitsLeft, afterFits = rtl ? fitsLeft : fitsRight;
    const topPos = [left + b.width / 2, b.y - frame.y - 6];
    let pos;
    switch (at ?? 'end') {
      case 'start': pos = beforeFits ? [beforeX, midY] : afterFits ? [afterX, midY] : topPos; break;
      case 'end':
        // A full-width field takes the marker inside its trailing edge, where typed text rarely reaches.
        if (b.field && !afterFits) { pos = [b.field === 'right' ? left + 22 : right - 22, midY]; break; }
        pos = afterFits ? [afterX, midY] : beforeFits ? [beforeX, midY] : topPos; break;
      case 'top': pos = topPos; break;
      case 'bottom': pos = [left + b.width / 2, b.y + b.height - frame.y + 6]; break;
      case 'center': pos = [left + b.width / 2, midY]; break;
      default: throw new Error(`Unknown marker anchor ${at}`);
    }
    const x = Math.min(Math.max(pos[0], 15), frame.w - 15);
    const y = Math.min(Math.max(pos[1], 15), frame.h - 15);
    return { x: +(x / frame.w * 100).toFixed(2), y: +(y / frame.h * 100).toFixed(2) };
  }

  /** Scroll so `loc` sits in the middle of the screen. */
  async function focus(loc) {
    await loc.first().evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await page.waitForTimeout(250);
  }

  /**
   * Save one screenshot plus its marker positions.
   * markers: { 1: locator | [locator, 'end'|'start'|'top'|'bottom'|'center'], ... } — default 'end' (beside the text, flips if no room)
   * opts.clip: a locator to capture instead of the viewport; opts.full: whole page.
   */
  async function shot(name, markers = {}, opts = {}) {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(350);
    const leftover = await page.evaluate(SWAP_VALUES);
    if (leftover.length) console.warn(`  ! ${name} still shows a real pharmacy name: ${leftover.join(', ')}`);
    const file = path.join(outDir, `${name}.png`);
    let frame;
    if (opts.clip) {
      const c = opts.clip.first();
      await c.scrollIntoViewIfNeeded();
      const b = await c.boundingBox();
      frame = { x: b.x, y: b.y, w: b.width, h: b.height };
      const markerPos = {};
      for (const [n, m] of Object.entries(markers)) {
        const [loc, at] = Array.isArray(m) ? m : [m];
        const p = await anchorOf(loc, at, frame);
        if (p) markerPos[n]= p; else console.warn(`  ! ${name} marker ${n} not found`);
      }
      await c.screenshot({ path: file, animations: 'disabled' });
      await page.evaluate(RESTORE_VALUES);
      return write(name, file, frame, markerPos);
    }
    if (opts.full) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const dims = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
      frame = { x: 0, y: 0, w: dims.w, h: dims.h };
    } else {
      const vp = page.viewportSize();
      frame = { x: 0, y: 0, w: vp.width, h: vp.height };
    }
    const markerPos = {};
    for (const [n, m] of Object.entries(markers)) {
      const [loc, at] = Array.isArray(m) ? m : [m];
      const p = await anchorOf(loc, at, frame);
      if (p) markerPos[n] = p; else console.warn(`  ! ${name} marker ${n} not found`);
    }
    await page.screenshot({ path: file, fullPage: !!opts.full, animations: 'disabled' });
    await page.evaluate(RESTORE_VALUES);
    return write(name, file, frame, markerPos);
  }

  function write(name, file, frame, markers) {
    const meta = {
      image: path.basename(file), device,
      width: Math.round(frame.w), height: Math.round(frame.h), markers,
      captured: new Date().toISOString().slice(0, 10), source,
    };
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(meta, null, 2) + '\n');
    console.log(`  ✓ ${lang}/${manual}/${name}.png (${Object.keys(markers).length} markers)`);
  }

  return { browser, context, page, L, shot, focus, base: `http://localhost:${port}`, lang, rtl };
}

/** Run `fn(session)` for each requested language. */
export async function run(manual, { port, device, source }, fn) {
  const arg = process.argv[2] ?? 'all';
  const langs = arg === 'all' ? ['en', 'ar'] : [arg];
  for (const lang of langs) {
    console.log(`${manual} · ${lang}`);
    const s = await session({ manual, port, lang, device, source });
    try {
      await fn(s);
    } finally {
      await s.browser.close();
    }
  }
}
