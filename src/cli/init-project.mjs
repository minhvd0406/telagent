import fs from 'node:fs';
import path from 'node:path';
import { parseFlags, PROJECT_CONFIG_DIR, PROJECT_ENV_FILE } from '../utils.mjs';
import { installRuleBlock, projectTargets, selectTargets } from '../agent-rules.mjs';
import { loadConfig, loadEnvFile, updateEnv } from '../config.mjs';
import { getMe, sendTextSmart } from '../telegram.mjs';

export async function initProject(argv) {
  const { flags } = parseFlags(argv);
  const targets = selectTargets(flags.all ? 'all' : null, flags);
  const language = flags.language || flags.lang || 'auto';
  for (const name of targets) {
    installRuleBlock(projectTargets[name], { language });
    console.log(`Installed ${name} project rules: ${projectTargets[name]}`);
  }
  if (flags.token || flags['chat-id'] || flags['chat-ids']) {
    const existing = loadEnvFile(PROJECT_ENV_FILE);
    const inherited = loadConfig();
    const token = String(flags.token || existing.REPORT_BOT_TOKEN || inherited.token || '').trim();
    const chatIds = String(flags['chat-id'] || flags['chat-ids'] || existing.TELEGRAM_ADMIN_CHAT_ID || inherited.adminChatIds.join(',') || '').trim();
    if (!token) throw new Error('--token is required when writing project Telegram config.');
    if (!chatIds) throw new Error('--chat-id is required when writing project Telegram config.');
    const me = await getMe(token);
    updateEnv({
      REPORT_BOT_TOKEN: token,
      TELEGRAM_ADMIN_CHAT_ID: chatIds,
      TELAGENT_POLL_INTERVAL_MS: existing.TELAGENT_POLL_INTERVAL_MS || '5000',
    }, PROJECT_ENV_FILE);
    fs.mkdirSync(PROJECT_CONFIG_DIR, { recursive: true });
    fs.writeFileSync(path.join(PROJECT_CONFIG_DIR, '.gitignore'), '.env\n', 'utf8');
    console.log(`Project Telegram config written: ${PROJECT_ENV_FILE} (@${me.username || me.first_name || 'bot'})`);
    if (flags.test) {
      for (const chatId of chatIds.split(',').map((s) => s.trim()).filter(Boolean)) {
        const { messageId } = await sendTextSmart(token, chatId, '🧭 Telagent project config test\n\nThis project is using its own Telegram config.', { plain: true });
        console.log(`Project test message sent to ${chatId} (messageId: ${messageId}).`);
      }
    }
  } else {
    console.log('No project Telegram config written. This project will use global config unless `.telagent/.env` exists.');
  }
}
