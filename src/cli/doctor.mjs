import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.mjs';
import { getMe } from '../telegram.mjs';
import { files, ensureRuntime } from '../runtime.mjs';
import { ROOT_DIR, RUNTIME_DIR, GLOBAL_ENV_FILE, PROJECT_ENV_FILE, ok, warn, fail } from '../utils.mjs';
import { globalTargets, hasRuleBlock } from '../agent-rules.mjs';

function nodeMajor() {
  return Number(process.versions.node.split('.')[0]);
}

export async function doctor() {
  let failures = 0;
  let warnings = 0;
  const check = (state, good, bad, warning = false) => {
    if (state) ok(good);
    else if (warning) { warnings++; warn(bad); }
    else { failures++; fail(bad); }
  };

  check(nodeMajor() >= 20, `Node.js ${process.versions.node} >= 20`, `Node.js ${process.versions.node} is below 20`);
  ok(`Telagent root: ${ROOT_DIR}`);
  ok(`Current directory: ${process.cwd()}`);
  const config = loadConfig();
  check(Boolean(config.source), `Config found: ${config.source}`, `No config found. Run \`telagent setup\` for global config or \`telagent setup --project\` inside a project.`);
  if (fs.existsSync(PROJECT_ENV_FILE)) ok(`Project config overrides global: ${PROJECT_ENV_FILE}`);
  else if (fs.existsSync(GLOBAL_ENV_FILE)) ok(`Using global config: ${GLOBAL_ENV_FILE}`);
  check(Boolean(config.token), 'REPORT_BOT_TOKEN configured', 'REPORT_BOT_TOKEN missing');
  check(config.adminChatIds.length > 0, 'Admin chat ID configured', 'TELEGRAM_ADMIN_CHAT_ID missing');

  if (config.token) {
    try {
      const me = await getMe(config.token);
      ok(`Bot token valid (@${me.username || me.first_name || 'bot'})`);
    } catch {
      failures++;
      fail('Bot token invalid or Telegram API unreachable');
    }
  }

  try {
    ensureRuntime();
    fs.accessSync(RUNTIME_DIR, fs.constants.W_OK);
    ok('Runtime directory writable');
  } catch {
    failures++;
    fail('Runtime directory missing or not writable');
  }

  for (const [name, file] of Object.entries(globalTargets)) {
    if (!fs.existsSync(file)) {
      warnings++;
      warn(`${name[0].toUpperCase() + name.slice(1)} rules file missing`);
    } else if (hasRuleBlock(file)) {
      ok(`${name[0].toUpperCase() + name.slice(1)} rules installed`);
    } else {
      warnings++;
      warn(`${name[0].toUpperCase() + name.slice(1)} rules not installed`);
    }
  }

  check(fs.existsSync(path.join(ROOT_DIR, 'rules', 'telegram-guide.md')), 'telegram-guide.md exists', 'rules/telegram-guide.md missing');
  check(fs.existsSync(path.join(ROOT_DIR, 'rules', 'report-template.md')), 'report-template.md exists', 'rules/report-template.md missing');
  check(fs.existsSync(files.sentRegistry) || fs.existsSync(RUNTIME_DIR), 'Runtime path ready', 'Runtime path not ready', true);

  console.log(`\nSummary: ${failures} error(s), ${warnings} warning(s).`);
  if (failures || warnings) console.log('Suggested fixes: run `telagent setup`, then `telagent test`.');
  if (failures) process.exitCode = 1;
}
