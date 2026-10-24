import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const skip = new Set(['all.mjs', 'prodsmoke.mjs']);
const only = process.argv[2]?.split(',');
const failed = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs') && !skip.has(f)).sort()) {
  if (only && !only.includes(path.basename(file, '.mjs'))) continue;
  const t0 = Date.now();
  const run = spawnSync('node', [path.join(dir, file)], { encoding: 'utf8' });
  const lines = (run.stdout + run.stderr).split('\n');
  const fails = lines.filter((l) => l.startsWith('FAIL'));
  const crashed = run.status !== 0 && !fails.length;
  console.log(`${fails.length || crashed ? 'FAIL' : 'ok  '} ${file} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  for (const l of fails) console.log(`     ${l}`);
  if (crashed) console.log(`     ${lines.filter(Boolean).slice(-3).join('\n     ')}`);
  if (fails.length || crashed) failed.push(file);
}
console.log(failed.length ? `\n${failed.length} failed: ${failed.join(', ')}` : '\nall passed');
process.exitCode = failed.length ? 1 : 0;
