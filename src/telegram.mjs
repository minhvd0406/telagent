import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { escapeMarkdownV2 } from './markdown.mjs';

const API = 'https://api.telegram.org/bot';
const MESSAGE_LIMIT = 4000;
const CAPTION_LIMIT = 1024;

async function telegramJson(token, method, payload) {
  const res = await fetch(`${API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) throw new Error(body.description || `Telegram HTTP ${res.status}`);
  return body.result;
}

export async function getMe(token) {
  return telegramJson(token, 'getMe', {});
}

export async function getUpdates(token, offset) {
  const url = `${API}${token}/getUpdates?offset=${offset || 0}&timeout=0&limit=100`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) throw new Error(body.description || `Telegram HTTP ${res.status}`);
  return body.result || [];
}

export async function react(token, chatId, messageId, emoji = '👍') {
  return telegramJson(token, 'setMessageReaction', {
    chat_id: chatId,
    message_id: messageId,
    reaction: [{ type: 'emoji', emoji }],
  });
}

export async function sendMessage(token, chatId, text, { plain = false, raw = false, replyTo = null } = {}) {
  const payload = { chat_id: chatId, text };
  if (!plain) {
    payload.parse_mode = 'MarkdownV2';
    payload.text = raw ? text : escapeMarkdownV2(text);
  }
  if (replyTo) payload.reply_parameters = { message_id: replyTo, allow_sending_without_reply: true };
  const result = await telegramJson(token, 'sendMessage', payload);
  if (!result?.message_id) throw new Error('Telegram accepted sendMessage but did not return message_id');
  return result.message_id;
}

export async function sendDocument(token, chatId, filePath, caption = '', { plain = false, raw = false, replyTo = null } = {}) {
  const post = async (asPlain) => {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('document', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
    if (caption) {
      form.append('caption', asPlain || plain ? String(caption).slice(0, CAPTION_LIMIT) : (raw ? String(caption).slice(0, CAPTION_LIMIT) : escapeMarkdownV2(String(caption).slice(0, CAPTION_LIMIT))));
      if (!asPlain && !plain) form.append('parse_mode', 'MarkdownV2');
    }
    if (replyTo) form.append('reply_parameters', JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
    const res = await fetch(`${API}${token}/sendDocument`, { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.description || `Telegram HTTP ${res.status}`);
    const id = body.result?.message_id;
    if (!id) throw new Error('Telegram accepted sendDocument but did not return message_id');
    return id;
  };
  try {
    return await post(false);
  } catch (error) {
    if (!plain && /parse entities|can't parse|can’t parse/i.test(error.message)) return post(true);
    throw error;
  }
}

export function tempMarkdownFile(content) {
  const file = path.join(os.tmpdir(), `telagent-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.md`);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

export async function sendTextSmart(token, chatId, text, opts = {}) {
  if (text.length > MESSAGE_LIMIT) {
    const tmp = tempMarkdownFile(text);
    try {
      return { messageId: await sendDocument(token, chatId, tmp, text.split('\n')[0] || 'Telagent report', { ...opts, plain: true }), mode: 'file' };
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }
  try {
    return { messageId: await sendMessage(token, chatId, text, opts), mode: opts.plain ? 'plain' : 'markdown' };
  } catch (error) {
    if (/parse entities|can't parse|can’t parse/i.test(error.message) && !opts.plain) {
      return { messageId: await sendMessage(token, chatId, text, { ...opts, plain: true }), mode: 'plain-fallback' };
    }
    throw error;
  }
}
