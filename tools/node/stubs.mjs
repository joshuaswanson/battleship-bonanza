const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {}, data: new Uint8ClampedArray(4) })), set: (t, k, v) => ((t[k] = v), true) });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }), documentElement: { lang: 'en' } };
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem() {} } });
globalThis.window ??= globalThis;
import { register } from 'node:module';
register('./envhook.mjs', import.meta.url);
import { readFile } from 'node:fs/promises';
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const s = String(u?.url ?? u);
  if (s.startsWith('http://local/')) { const b = await readFile(new URL('../../public/' + s.slice(13), import.meta.url)); return new Response(b); }
  return realFetch(u, o);
};
globalThis.ProgressEvent ??= class extends Event { constructor(t, o = {}) { super(t); Object.assign(this, o); } };
