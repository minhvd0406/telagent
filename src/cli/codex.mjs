import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { requireConfig } from '../config.mjs';
import { parseFlags } from '../utils.mjs';
import { fetchInbox } from '../runtime.mjs';

function readPromptFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data.text) throw new Error(`Inbox prompt has no text: ${file}`);
  return data;
}

function codexArgs({ cwd, prompt, danger = false, resumeLast = false }) {
  if (resumeLast) {
    const args = ['exec', 'resume', '--last'];
    if (danger) args.push('--dangerously-bypass-approvals-and-sandbox');
    args.push(prompt);
    return args;
  }

  const args = [
    'exec',
    '--cd', cwd,
    '--add-dir', path.join(os.homedir(), '.local', 'state', 'telagent'),
    '--add-dir', path.join(os.homedir(), '.gradle'),
    '--sandbox', 'workspace-write',
  ];
  if (danger) args.push('--dangerously-bypass-approvals-and-sandbox');
  args.push(prompt);
  return args;
}

function runCodex({ cwd, prompt, danger = false, resumeLast = false }) {
  return new Promise((resolve) => {
    const args = codexArgs({ cwd, prompt, danger, resumeLast });
    const child = spawn('codex', args, {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        TELAGENT_PROJECT_CODE: path.basename(cwd),
      },
    });
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function handlePromptFile(file, options) {
  const prompt = readPromptFile(file);
  console.log(`\n--- Telegram instruction ${prompt.chatId}:${prompt.messageId} ---`);
  console.log(prompt.text);
  console.log('--- Running Codex ---\n');
  const result = await runCodex({ ...options, prompt: prompt.text });
  console.log(`\n--- Codex finished: ${result.signal || result.code} ---\n`);
}

async function pollOnce(config, options) {
  const files = await fetchInbox(config);
  for (const file of files) await handlePromptFile(file, options);
  return files.length > 0;
}

export async function codex(argv = []) {
  const { flags } = parseFlags(argv);
  const config = requireConfig();
  const cwd = path.resolve(String(flags.cd || flags.cwd || process.cwd()));
  const watch = Boolean(flags.watch || flags.daemon);
  const options = {
    cwd,
    danger: Boolean(flags.danger || flags['dangerously-bypass-approvals-and-sandbox']),
    resumeLast: Boolean(flags['resume-last']),
  };

  if (!fs.existsSync(cwd)) throw new Error(`--cd directory does not exist: ${cwd}`);
  if (flags.prompt) {
    await handlePromptFile(path.resolve(String(flags.prompt)), options);
    return;
  }
  if (!watch) {
    const gotMessage = await pollOnce(config, options);
    if (!gotMessage) console.log('No Telegram inbox messages.');
    return;
  }

  console.log(`Watching Telegram and running Codex in ${cwd}`);
  console.log(`Mode: ${options.resumeLast ? 'codex exec resume --last' : 'codex exec'}`);
  console.log(`Poll interval: ${config.pollIntervalMs}ms`);
  while (true) {
    await pollOnce(config, options);
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}
