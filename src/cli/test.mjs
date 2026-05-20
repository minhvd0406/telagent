import { requireConfig } from '../config.mjs';
import { sendTextSmart } from '../telegram.mjs';

export async function test() {
  const config = requireConfig();
  const text = '🧭 Telagent test message\n\nIf you see this, your Telegram bridge is working.';
  for (const chatId of config.adminChatIds) {
    const { messageId } = await sendTextSmart(config.token, chatId, text, { plain: true });
    console.log(`Sent test message to ${chatId} (messageId: ${messageId}).`);
  }
}
