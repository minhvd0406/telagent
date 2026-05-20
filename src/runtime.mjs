import fs from 'node:fs';
import path from 'node:path';
import { getUpdates, react, sendTextSmart } from './telegram.mjs';
import { RUNTIME_DIR, ensureDir, readJsonLines, writeJsonLines, atomicWriteFile, appendJsonLineAtomic } from './utils.mjs';
import { acquireLock, releaseLock } from './locks.mjs';

export const files = {
  sentRegistry: path.join(RUNTIME_DIR, 'sent-registry.jsonl'),
  cache: path.join(RUNTIME_DIR, 'updates-cache.jsonl'),
  globalOffset: path.join(RUNTIME_DIR, 'global-offset.txt'),
  pollLock: path.join(RUNTIME_DIR, 'poll.lock'),
  registry: path.join(RUNTIME_DIR, 'listener-registry.jsonl'),
  registryLock: path.join(RUNTIME_DIR, 'registry.lock'),
  systemIds: path.join(RUNTIME_DIR, 'system-msg-ids.jsonl'),
  systemIdsLock: path.join(RUNTIME_DIR, 'system-msg-ids.lock'),
  audit: path.join(RUNTIME_DIR, 'fetch-audit.jsonl'),
};

export function ensureRuntime() {
  ensureDir(RUNTIME_DIR);
}

export function readOffset(file) {
  try {
    const n = Number(fs.readFileSync(file, 'utf8').trim());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function writeOffset(file, updateId) {
  atomicWriteFile(file, String(updateId + 1));
}

export function recordSent(messageId, chatId, projectCode) {
  appendJsonLineAtomic(files.sentRegistry, {
    messageId,
    chatId: String(chatId),
    projectCode,
    timestamp: Math.floor(Date.now() / 1000),
  });
}

export function filterKey(ids) {
  return String(ids.join('-')).slice(0, 120);
}

export function promptFileFor(ids) {
  return path.join(RUNTIME_DIR, `prompt-${filterKey(ids)}.json`);
}

export function defaultOffsetFile(ids) {
  return path.join(RUNTIME_DIR, `${ids[0]}-offset.txt`);
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function strictSuperset(other, mine) {
  if (!other?.length || !mine?.length || other.length <= mine.length) return false;
  const set = new Set(other);
  return mine.every((id) => set.has(id));
}

export function refreshListener(ids, offsetFile) {
  if (!acquireLock(files.registryLock)) return null;
  try {
    const pid = process.ppid || process.pid;
    const entries = readJsonLines(files.registry).filter((entry) => entry.pid !== pid && isAlive(entry.pid));
    const mine = { pid, filter: ids, offsetFile, startedAt: Date.now() };
    const all = [...entries, mine].slice(-100);
    writeJsonLines(files.registry, all);
    return all.find((entry) => entry.pid !== pid && strictSuperset(entry.filter, ids));
  } finally {
    releaseLock(files.registryLock);
  }
}

function systemKey(chatId, messageId) {
  return `${chatId}:${messageId}`;
}

function readSystemIds() {
  return new Set(readJsonLines(files.systemIds).map((e) => systemKey(e.chatId, e.messageId)));
}

function readSentIds() {
  return new Set(readJsonLines(files.sentRegistry).map((e) => systemKey(e.chatId, e.messageId)));
}

function writeSystemId(chatId, messageId) {
  if (!acquireLock(files.systemIdsLock)) return;
  try {
    appendJsonLineAtomic(files.systemIds, { chatId: String(chatId), messageId, timestamp: Date.now() });
  } finally {
    releaseLock(files.systemIdsLock);
  }
}

function isAdminMessage(update, adminIds) {
  const msg = update.message;
  return msg?.text && (!adminIds.length || adminIds.includes(String(msg.chat.id)));
}

function isOrphan(update, adminIds, systemIds, sentIds) {
  const msg = update.message;
  if (!isAdminMessage(update, adminIds)) return false;
  if (String(msg.text).trim().startsWith('/')) return false;
  if (msg.chat?.type !== 'private' && msg.chat?.type !== 'group' && msg.chat?.type !== 'supergroup') return false;
  if (!msg.reply_to_message) return true;
  const replyKey = systemKey(msg.chat.id, msg.reply_to_message.message_id);
  if (systemIds.has(replyKey)) return true;
  return !sentIds.has(replyKey);
}

export async function fetchIntoCache(config) {
  ensureRuntime();
  if (!acquireLock(files.pollLock)) return;
  const systemIds = readSystemIds();
  const sentIds = readSentIds();
  const orphanEntries = [];
  try {
    const offset = readOffset(files.globalOffset);
    const updates = await getUpdates(config.token, offset);
    if (!updates.length) return;
    const nonOrphans = [];
    for (const update of updates) {
      if (isOrphan(update, config.adminChatIds, systemIds, sentIds)) orphanEntries.push(update);
      else nonOrphans.push(update);
    }
    const cache = [...readJsonLines(files.cache), ...nonOrphans].slice(-500);
    writeJsonLines(files.cache, cache);
    appendJsonLineAtomic(files.audit, {
      timestamp: Math.floor(Date.now() / 1000),
      fetched: updates.length,
      cached: nonOrphans.length,
      orphans: orphanEntries.length,
    });
    writeOffset(files.globalOffset, Math.max(...updates.map((u) => u.update_id)));
  } finally {
    releaseLock(files.pollLock);
  }
  for (const update of orphanEntries) {
    const msg = update.message;
    try { await react(config.token, msg.chat.id, msg.message_id, '💔'); } catch {}
    try {
      const { messageId } = await sendTextSmart(config.token, msg.chat.id, '[SYSTEM] Please reply to a specific Telagent agent message.', { plain: true, replyTo: msg.message_id });
      writeSystemId(msg.chat.id, messageId);
    } catch {}
  }
}

export function findReplies(ids, adminIds, offsetFile) {
  const offset = readOffset(offsetFile);
  const idSet = new Set(ids);
  const updates = readJsonLines(files.cache).filter((u) => u.update_id >= offset);
  const matches = updates.filter((u) => {
    const msg = u.message;
    if (!msg?.text) return false;
    if (adminIds.length && !adminIds.includes(String(msg.chat.id))) return false;
    return idSet.has(Number(msg.reply_to_message?.message_id));
  });
  if (updates.length) writeOffset(offsetFile, Math.max(...updates.map((u) => u.update_id)));
  return matches;
}

export function writePrompt(updates, ids) {
  const messages = updates.map((u) => u.message);
  const [first, ...rest] = messages;
  const last = messages[messages.length - 1];
  const text = [first.text, ...rest.map((m) => `Admin follow-up: ${m.text}`)].join('\n\n');
  const data = {
    text,
    messageId: last.message_id,
    chatId: String(last.chat.id),
    fromUserId: String(last.from?.id ?? last.chat.id),
    replyToMessageId: last.reply_to_message?.message_id ?? null,
    timestamp: last.date,
  };
  const file = promptFileFor(ids);
  atomicWriteFile(file, JSON.stringify(data, null, 2));
  return file;
}
