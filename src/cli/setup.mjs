import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { loadConfig, loadEnvFile, maskToken, updateEnv } from '../config.mjs';
import { getMe, sendTextSmart } from '../telegram.mjs';
import { globalTargets, projectTargets, installRuleBlock, cursorInstruction } from '../agent-rules.mjs';
import { ensureRuntime } from '../runtime.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { parseFlags, GLOBAL_ENV_FILE, PROJECT_ENV_FILE, PROJECT_CONFIG_DIR } from '../utils.mjs';

function normalizeInstallChoice(choice) {
  const raw = String(choice || 'all').trim().toLowerCase();
  if (['all', 'claude', 'codex', 'gemini', 'cursor', 'skip'].includes(raw)) return raw;
  throw new Error('Install choice must be one of: all, claude, codex, gemini, cursor, skip.');
}

function boolFromFlags(flags, yesValue = true) {
  if (flags.test || flags.yes || flags.y) return true;
  if (flags['no-test'] || flags.n) return false;
  return yesValue;
}

export async function setup(argv = []) {
  const { flags } = parseFlags(argv);
  const targetEnvFile = flags.project || flags.local ? PROJECT_ENV_FILE : GLOBAL_ENV_FILE;
  const env = loadEnvFile(targetEnvFile);
  const currentConfig = loadConfig();
  const rl = readline.createInterface({ input, output });
  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
  try {
    const currentToken = process.env.REPORT_BOT_TOKEN || env.REPORT_BOT_TOKEN || currentConfig.token || '';
    const currentChats = process.env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_ADMIN_CHAT_ID || currentConfig.adminChatIds.join(',') || '';
    const flagToken = flags.token ? String(flags.token).trim() : '';
    const flagChats = flags['chat-id'] || flags['chat-ids'] ? String(flags['chat-id'] || flags['chat-ids']).trim() : '';
    const flagInstall = flags.install ? String(flags.install).trim() : '';
    const flagLanguage = flags.language || flags.lang ? String(flags.language || flags.lang).trim() : '';

    const tokenPrompt = currentToken ? `Telegram bot token [${maskToken(currentToken)}]: ` : 'Telegram bot token: ';
    const token = flagToken || (await question(tokenPrompt)).trim() || currentToken;
    const chatPrompt = currentChats ? `Admin chat ID [${currentChats}]: ` : 'Admin chat ID: ';
    const chatIds = flagChats || (await question(chatPrompt)).trim() || currentChats;
    const installChoice = normalizeInstallChoice(flagInstall || await question('Install agent rules? [all/claude/codex/gemini/cursor/skip]: ') || 'all');
    const language = flagLanguage || (installChoice === 'skip' ? 'auto' : (await question('Telegram report language? [auto/vi/en]: ') || 'auto').trim());
    const sendTest = (flags.test || flags.yes || flags.y || flags['no-test'] || flags.n)
      ? boolFromFlags(flags)
      : String(await question('Send test message? [Y/n]: ') || 'Y').trim().toLowerCase() !== 'n';

    if (!token) throw new Error('Telegram bot token is required.');
    if (!chatIds) throw new Error('Admin chat ID is required.');

    const me = await getMe(token);
    console.log(`Bot token valid for @${me.username || me.first_name || 'bot'}.`);

    updateEnv({
      REPORT_BOT_TOKEN: token,
      TELEGRAM_ADMIN_CHAT_ID: chatIds,
      TELAGENT_POLL_INTERVAL_MS: env.TELAGENT_POLL_INTERVAL_MS || env.TELE_POLL_INTERVAL_MS || '5000',
    }, targetEnvFile);
    if (flags.project || flags.local) {
      fs.mkdirSync(PROJECT_CONFIG_DIR, { recursive: true });
      fs.writeFileSync(path.join(PROJECT_CONFIG_DIR, '.gitignore'), '.env\n', 'utf8');
    }
    ensureRuntime();
    console.log(`Config updated: ${targetEnvFile}`);

    if (installChoice !== 'skip') {
      if (installChoice === 'cursor') {
        console.log(cursorInstruction({ language }));
      } else {
        const names = installChoice === 'all' ? ['claude', 'codex', 'gemini'] : [installChoice];
        const targets = flags.project || flags.local ? projectTargets : globalTargets;
        for (const name of names) {
          installRuleBlock(targets[name], { language });
          console.log(`Installed ${name} rules: ${targets[name]}`);
        }
      }
    }

    if (sendTest) {
      const config = loadConfig();
      for (const chatId of config.adminChatIds) {
        const { messageId } = await sendTextSmart(config.token, chatId, '🧭 Telagent setup complete\n\nIf you see this, your Telegram bridge is working.', { plain: true });
        console.log(`Test message sent to ${chatId} (messageId: ${messageId}).`);
      }
    }
  } finally {
    rl.close();
  }
}
