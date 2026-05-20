import fs from 'node:fs';
import path from 'node:path';
import { requireConfig } from '../config.mjs';
import { parseFlags, readStdinIfPiped, projectCode } from '../utils.mjs';
import { sendDocument, sendTextSmart, react } from '../telegram.mjs';
import { defaultOffsetFile, ensureRuntime, recordSent } from '../runtime.mjs';
import { listenLoop } from './listen.mjs';

export async function send(argv) {
  const { flags, positional } = parseFlags(argv);
  const config = requireConfig();
  ensureRuntime();
  const code = projectCode();

  if (flags.react) {
    const id = Number(flags.react);
    if (!Number.isInteger(id) || id <= 0) throw new Error('--react requires a positive message ID.');
    for (const chatId of config.adminChatIds) {
      await react(config.token, chatId, id);
      console.log(`Reacted 👍 to ${id} in ${chatId}.`);
    }
    return;
  }

  const opts = {
    plain: Boolean(flags.plain),
    raw: Boolean(flags.raw),
    replyTo: flags['reply-to'] ? Number(flags['reply-to']) : null,
  };
  if (flags['reply-to'] && (!Number.isInteger(opts.replyTo) || opts.replyTo <= 0)) {
    throw new Error('--reply-to requires a positive message ID.');
  }

  const sentIds = [];
  if (flags.file) {
    const filePath = path.resolve(String(flags.file));
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const rawCaption = positional.join(' ').trim() || readStdinIfPiped().trim();
    const caption = rawCaption && code ? `[${code}] ${rawCaption}` : rawCaption;
    for (const chatId of config.adminChatIds) {
      const messageId = await sendDocument(config.token, chatId, filePath, caption, opts);
      recordSent(messageId, chatId, code);
      sentIds.push(messageId);
      console.log(`Document sent to ${chatId} (messageId: ${messageId}).`);
    }
  } else {
    const rawText = flags.stdin ? readStdinIfPiped().trim() : (positional.join(' ').trim() || readStdinIfPiped().trim());
    if (!rawText) throw new Error('No message provided. Use `telagent send "message"` or pipe stdin.');
    const text = code ? `[${code}] ${rawText}` : rawText;
    for (const chatId of config.adminChatIds) {
      const { messageId, mode } = await sendTextSmart(config.token, chatId, text, opts);
      recordSent(messageId, chatId, code);
      sentIds.push(messageId);
      console.log(`Message sent to ${chatId} (${mode}, messageId: ${messageId}).`);
    }
  }

  if (flags['wait-reply']) {
    const offsetFile = defaultOffsetFile(sentIds);
    console.log(`Listening for replies to ${sentIds.join(',')} every ${config.pollIntervalMs}ms...`);
    await listenLoop({ replyTo: sentIds, offsetFile, config });
  }
}
