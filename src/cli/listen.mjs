import { requireConfig } from '../config.mjs';
import { parseFlags } from '../utils.mjs';
import { defaultOffsetFile, ensureRuntime, fetchIntoCache, findReplies, refreshListener, writePrompt } from '../runtime.mjs';
import { react } from '../telegram.mjs';

function parseIds(value) {
  const ids = String(value || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error('--reply-to requires one or more positive message IDs.');
  }
  return ids;
}

export async function listenOnce({ replyTo, offsetFile, config }) {
  ensureRuntime();
  const superseder = refreshListener(replyTo, offsetFile);
  if (superseder) {
    console.log(`Superseded by listener pid=${superseder.pid}; exiting.`);
    return true;
  }
  await fetchIntoCache(config);
  const matches = findReplies(replyTo, config.adminChatIds, offsetFile);
  if (!matches.length) {
    return false;
  }
  const promptFile = writePrompt(matches, replyTo);
  for (const update of matches) {
    const msg = update.message;
    try { await react(config.token, msg.chat.id, msg.message_id, '👍'); } catch {}
  }
  console.log(`Prompt written to ${promptFile}`);
  return true;
}

export async function listenLoop({ replyTo, offsetFile, config }) {
  while (true) {
    const done = await listenOnce({ replyTo, offsetFile, config });
    if (done) return;
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

export async function listen(argv) {
  const { flags } = parseFlags(argv);
  const config = requireConfig();
  const replyTo = parseIds(flags['reply-to']);
  const offsetFile = flags['offset-file'] ? String(flags['offset-file']) : defaultOffsetFile(replyTo);
  console.log(`Listening for replies to ${replyTo.join(',')} every ${config.pollIntervalMs}ms...`);
  await listenLoop({ replyTo, offsetFile, config });
}
