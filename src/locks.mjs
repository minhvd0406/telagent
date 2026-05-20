import fs from 'node:fs';
import path from 'node:path';
import { ensureDir } from './utils.mjs';

const STALE_MS = 30_000;

export function acquireLock(file, staleMs = STALE_MS) {
  ensureDir(path.dirname(file));
  try {
    const fd = fs.openSync(file, 'wx');
    fs.writeFileSync(fd, String(Date.now()));
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    try {
      const ts = Number(fs.readFileSync(file, 'utf8'));
      if (ts && Date.now() - ts > staleMs) {
        fs.unlinkSync(file);
        return acquireLock(file, staleMs);
      }
    } catch {}
    return false;
  }
}

export function releaseLock(file) {
  try { fs.unlinkSync(file); } catch {}
}

export async function withLock(file, fn) {
  if (!acquireLock(file)) return null;
  try {
    return await fn();
  } finally {
    releaseLock(file);
  }
}
