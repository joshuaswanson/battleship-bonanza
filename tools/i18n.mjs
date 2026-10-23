import { check } from './lib.mjs';

globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.document = { documentElement: {} };
const { ITEM_IDS } = await import('../src/items.js');
const i18n = await import('../src/i18n.js');
const source = (await import('node:fs')).readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');

const block = (name, lang) => {
  const start = source.indexOf(`const ${name} = {`);
  const at = source.indexOf(`\n  ${lang}: {`, start);
  const end = source.indexOf('\n  },', at);
  return [...source.slice(at, end).matchAll(/^ {4}'?([\w+]+)'?:/gm)].map((m) => m[1]);
};

const langs = i18n.LANGUAGES.map((l) => l.id);
const english = new Set(block('STRINGS', 'en'));
for (const lang of langs.filter((l) => l !== 'en')) {
  const keys = new Set(block('STRINGS', lang));
  const missing = [...english].filter((k) => !keys.has(k));
  check(`${lang}: all interface text translated`, missing.length === 0, missing.join(', '));
}
for (const lang of langs) {
  i18n.setLang(lang);
  const items = ITEM_IDS.filter((id) => !i18n.itemName(id) || !i18n.itemBlurb(id));
  check(`${lang}: every attachment has a name and description`, items.length === 0, items.join(', '));
  const pairs = [];
  for (const a of ITEM_IDS) for (const b of ITEM_IDS) if (a < b && !i18n.comboName([a, b])) pairs.push(`${a}+${b}`);
  check(`${lang}: every combo has a name`, pairs.length === 0, pairs.slice(0, 5).join(', '));
}
