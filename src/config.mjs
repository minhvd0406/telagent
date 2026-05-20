import fs from 'node:fs';
import { parseCsv, atomicWriteFile, GLOBAL_ENV_FILE, PROJECT_ENV_FILE, PACKAGE_ENV_FILE } from './utils.mjs';

export const ENV_FILE = GLOBAL_ENV_FILE;
let knownToken = process.env.REPORT_BOT_TOKEN || '';

export function loadEnvFile(file = ENV_FILE) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function loadConfig() {
  const packageEnv = loadEnvFile(PACKAGE_ENV_FILE);
  const globalEnv = loadEnvFile(GLOBAL_ENV_FILE);
  const projectEnv = loadEnvFile(PROJECT_ENV_FILE);
  const env = { ...packageEnv, ...globalEnv, ...projectEnv };
  const source = fs.existsSync(PROJECT_ENV_FILE)
    ? PROJECT_ENV_FILE
    : fs.existsSync(GLOBAL_ENV_FILE)
      ? GLOBAL_ENV_FILE
      : fs.existsSync(PACKAGE_ENV_FILE)
        ? PACKAGE_ENV_FILE
        : null;
  const token = process.env.REPORT_BOT_TOKEN || env.REPORT_BOT_TOKEN || '';
  knownToken = token || knownToken;
  return {
    token,
    adminChatIds: parseCsv(process.env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_ADMIN_CHAT_ID),
    pollIntervalMs: Number(process.env.TELAGENT_POLL_INTERVAL_MS || env.TELAGENT_POLL_INTERVAL_MS || env.TELE_POLL_INTERVAL_MS || 5000),
    source,
  };
}

export function requireConfig() {
  const config = loadConfig();
  if (!config.token) throw new Error('Missing REPORT_BOT_TOKEN. Run `telagent setup`.');
  if (!config.adminChatIds.length) throw new Error('Missing TELEGRAM_ADMIN_CHAT_ID. Run `telagent setup`.');
  return config;
}

export function updateEnv(values, file = ENV_FILE) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const pending = new Map(Object.entries(values));
  const lines = existing.map((line) => {
    const match = line.match(/^([A-Za-z0-9_]+)\s*=/);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1]);
    pending.delete(match[1]);
    return `${match[1]}=${value}`;
  });
  for (const [key, value] of pending) lines.push(`${key}=${value}`);
  atomicWriteFile(file, lines.join('\n').replace(/\n*$/, '\n'));
  if (values.REPORT_BOT_TOKEN) knownToken = values.REPORT_BOT_TOKEN;
}

export function scrubSecrets(text) {
  let out = String(text);
  const tokens = [knownToken, process.env.REPORT_BOT_TOKEN].filter(Boolean);
  for (const token of tokens) out = out.split(token).join(maskToken(token));
  return out;
}

export function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
