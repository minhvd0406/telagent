import fs from 'node:fs';
import path from 'node:path';
import { homePath, ensureDir } from './utils.mjs';

export const START = '<!-- telagent:start -->';
export const END = '<!-- telagent:end -->';

export const RULE_BLOCK = `${START}
## Telegram Reporting

When the user asks to send a Telegram report, ping them, tele them, notify them when done, or wait for Telegram instructions, use the centralized Telagent bridge.

Read this guide before using Telagent:

\`\`\`text
telagent guide
\`\`\`

Common commands:

\`\`\`bash
telagent send "<message>"
telagent send "<message>" --wait-reply
telagent listen --reply-to <messageId>
\`\`\`

Use \`send\` for one-way reports. Use \`send --wait-reply\` only when the user asks to wait for follow-up instructions.
${END}`;

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

export function installRuleBlock(file) {
  ensureDir(path.dirname(file));
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch {}
  const re = new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
  const next = re.test(text)
    ? text.replace(re, RULE_BLOCK)
    : `${text.replace(/\s*$/, '')}${text.trim() ? '\n\n' : ''}${RULE_BLOCK}\n`;
  fs.writeFileSync(file, next, 'utf8');
}

export function selectTargets(kind, flags = {}) {
  if (flags.all) return ['claude', 'codex', 'gemini'];
  const selected = ['claude', 'codex', 'gemini'].filter((name) => flags[name]);
  if (selected.length) return selected;
  if (kind && kind !== 'all') return [kind];
  return ['claude', 'codex', 'gemini'];
}

export function cursorInstruction() {
  return `Cursor support: the global user-rules file is not reliable across OS versions.
Open Cursor -> Settings -> Rules -> User Rules, then paste this block:

${RULE_BLOCK}`;
}
