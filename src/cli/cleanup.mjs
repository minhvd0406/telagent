import fs from 'node:fs';
import path from 'node:path';
import { parseFlags, ageMs, RUNTIME_DIR, readJsonLines, writeJsonLines } from '../utils.mjs';
import { files, ensureRuntime, isAlive } from '../runtime.mjs';

function isCleanable(file) {
  return /^prompt-.*\.processing\.json$/.test(file) ||
    /^prompt-.*\.json$/.test(file) ||
    file === 'fetch-audit.jsonl' ||
    file === 'updates-cache.jsonl' ||
    file.endsWith('.lock');
}

export async function cleanup(argv) {
  const { flags } = parseFlags(argv);
  ensureRuntime();
  const dryRun = Boolean(flags['dry-run']);
  const maxAge = ageMs(flags['older-than'] || '7d');
  const cutoff = Date.now() - maxAge;
  let removed = 0;

  for (const name of fs.readdirSync(RUNTIME_DIR)) {
    const file = path.join(RUNTIME_DIR, name);
    const stat = fs.statSync(file);
    if (!stat.isFile() || !isCleanable(name) || stat.mtimeMs > cutoff) continue;
    if (/^prompt-.*\.json$/.test(name) && !name.endsWith('.processing.json')) continue;
    if (dryRun) console.log(`Would remove ${file}`);
    else {
      fs.unlinkSync(file);
      console.log(`Removed ${file}`);
    }
    removed++;
  }

  const registry = readJsonLines(files.registry).filter((entry) => isAlive(entry.pid));
  if (dryRun) console.log(`Would keep ${registry.length} live listener registry entries.`);
  else writeJsonLines(files.registry, registry);

  console.log(`${dryRun ? 'Dry run complete' : 'Cleanup complete'}: ${removed} file(s) matched.`);
}
