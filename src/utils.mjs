import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(SRC_DIR, '..');
export const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.config', 'telagent');
export const GLOBAL_ENV_FILE = path.join(GLOBAL_CONFIG_DIR, '.env');
export const PROJECT_CONFIG_DIR = path.join(process.cwd(), '.telagent');
export const PROJECT_ENV_FILE = path.join(PROJECT_CONFIG_DIR, '.env');
export const PACKAGE_ENV_FILE = path.join(ROOT_DIR, '.env');
export const STATE_DIR = path.join(os.homedir(), '.local', 'state', 'telagent');
export const RUNTIME_DIR = process.env.TELAGENT_RUNTIME_DIR || path.join(STATE_DIR, 'reply');

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function parseCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key.includes('=')) {
      const [k, ...rest] = key.split('=');
      flags[k] = rest.join('=');
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return { flags, positional };
}

export function atomicWriteFile(file, content) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

export function readJsonLines(file) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function writeJsonLines(file, entries) {
  atomicWriteFile(file, entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''));
}

export function appendJsonLineAtomic(file, entry) {
  const entries = readJsonLines(file);
  entries.push(entry);
  writeJsonLines(file, entries);
}

export function projectCode() {
  return process.env.TELAGENT_PROJECT_CODE ||
    process.env.TELE_PROJECT_CODE ||
    path.basename(process.cwd()) ||
    '';
}

export function readStdinIfPiped() {
  if (process.stdin.isTTY) return '';
  return fs.readFileSync(0, 'utf8');
}

export function homePath(...parts) {
  return path.join(os.homedir(), ...parts);
}

export function ageMs(spec = '7d') {
  const match = String(spec).trim().match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration "${spec}". Use formats like 30m, 12h, 7d.`);
  const n = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return n * unit;
}

export function ok(text) { console.log(`✅ ${text}`); }
export function warn(text) { console.log(`⚠️ ${text}`); }
export function fail(text) { console.log(`❌ ${text}`); }
