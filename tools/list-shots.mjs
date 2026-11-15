// Lists every screenshot a manual expects, what it must show, and whether it exists yet.
//   node tools/list-shots.mjs [manual] [--missing] > checklist.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const onlyMissing = args.includes('--missing');
const wanted = args.find((a) => !a.startsWith('--'));
const manuals = wanted ? [wanted] : fs.readdirSync(path.join(root, 'content', 'en')).map((f) => f.replace(/\.md$/, ''));

const out = [];
for (const manual of manuals) {
  out.push(`# ${manual}\n`);
  for (const lang of ['en', 'ar']) {
    const file = path.join(root, 'content', lang, `${manual}.md`);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').replace(/\r/g, '').split('\n');
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('::shot ')) continue;
      const [name, caption = ''] = lines[i].slice(7).split('|').map((s) => s.trim());
      const callouts = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      while (j < lines.length && /^\d+\.\s+/.test(lines[j])) callouts.push(lines[j++].replace(/^\d+\.\s+/, ''));
      const have = fs.existsSync(path.join(root, 'shots', lang, manual, `${name}.png`));
      if (onlyMissing && have) continue;
      rows.push(`- [${have ? 'x' : ' '}] \`shots/${lang}/${manual}/${name}.png\` — ${caption}`);
      callouts.forEach((c, k) => rows.push(`    ${k + 1}. ${c}`));
    }
    if (rows.length) out.push(`## ${lang === 'en' ? 'English app screens' : 'Arabic app screens'}\n`, ...rows, '');
  }
}
process.stdout.write(out.join('\n') + '\n');
