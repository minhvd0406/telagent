import fs from 'node:fs';
import path from 'node:path';
import { homePath, ensureDir } from './utils.mjs';

export const START = '<!-- telagent:start -->';
export const END = '<!-- telagent:end -->';

const LANGUAGE_LABELS = {
  auto: 'the user language from the current conversation',
  vi: 'Vietnamese',
  en: 'English',
};

export function normalizeReportLanguage(value = 'auto') {
  const raw = String(value || 'auto').trim();
  const lower = raw.toLowerCase();
  if (['auto', 'default'].includes(lower)) return 'auto';
  if (['vi', 'vie', 'vietnamese', 'tieng-viet', 'tiếng-việt', 'tieng viet', 'tiếng việt'].includes(lower)) return 'vi';
  if (['en', 'eng', 'english'].includes(lower)) return 'en';
  return raw;
}

function languageInstruction(language = 'auto') {
  const normalized = normalizeReportLanguage(language);
  return LANGUAGE_LABELS[normalized] || normalized;
}

export function buildRuleBlock({ language = 'auto' } = {}) {
  const normalizedLanguage = normalizeReportLanguage(language);
  const languageText = languageInstruction(normalizedLanguage);
  return `${START}
## Telegram Reporting

Use the centralized Telagent bridge to report task status on Telegram.

Telegram report language: ${languageText}.

Read this guide before using Telagent:

\`\`\`text
telagent guide
\`\`\`

Common commands:

\`\`\`bash
telagent send "<message>"
telagent send "<message>" --wait-reply
telagent listen --reply-to <messageId>
telagent inbox
telagent codex --watch --cd <project>
\`\`\`

Default behavior:

- Before starting a user task and before sending a final response, run \`telagent inbox\`. If it prints an inbox prompt path, read that JSON and treat its \`text\` as the latest user instruction.
- If the user wants Telegram messages to start local Codex work automatically, tell them to run \`telagent codex --watch --cd <project>\` in a terminal.
- At the end of every completed user task, send a short Telegram completion report with \`telagent send "<summary>"\`.
- If blocked, failing validation, or needing a user decision, send a short Telegram status report.
- Use \`send --wait-reply\` only when the user asks to wait for follow-up instructions.
- Do not send Telegram messages for tiny conversational replies, status-only chat updates, or while still actively working.
- Write Telegram reports in natural, close, familiar language. Prefer first-person summaries like "mình đã làm..." for completed work and "mình cần bạn..." for decisions, blockers, or next actions.
- Make the report actionable: the user should immediately know whether the task is done, failed, blocked, or waiting for their decision.
${END}`;
}

export const RULE_BLOCK = buildRuleBlock();

export const globalTargets = {
  claude: homePath('.claude', 'CLAUDE.md'),
  gemini: homePath('.gemini', 'GEMINI.md'),
  codex: homePath('.codex', 'AGENTS.md'),
};

export const projectTargets = {
  claude: path.join(process.cwd(), 'CLAUDE.md'),
  gemini: path.join(process.cwd(), 'GEMINI.md'),
  codex: path.join(process.cwd(), 'AGENTS.md'),
};

export function hasRuleBlock(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text.includes(START) && text.includes(END);
  } catch {
    return false;
  }
}

export function installRuleBlock(file, options = {}) {
  ensureDir(path.dirname(file));
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch {}
  const ruleBlock = buildRuleBlock(options);
  const re = new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
  const next = re.test(text)
    ? text.replace(re, ruleBlock)
    : `${text.replace(/\s*$/, '')}${text.trim() ? '\n\n' : ''}${ruleBlock}\n`;
  fs.writeFileSync(file, next, 'utf8');
}

export function selectTargets(kind, flags = {}) {
  if (flags.all) return ['claude', 'codex', 'gemini'];
  const selected = ['claude', 'codex', 'gemini'].filter((name) => flags[name]);
  if (selected.length) return selected;
  if (kind && kind !== 'all') return [kind];
  return ['claude', 'codex', 'gemini'];
}

export function cursorInstruction(options = {}) {
  return `Cursor support: the global user-rules file is not reliable across OS versions.
Open Cursor -> Settings -> Rules -> User Rules, then paste this block:

${buildRuleBlock(options)}`;
}
