#!/usr/bin/env node
import { setup } from '../src/cli/setup.mjs';
import { doctor } from '../src/cli/doctor.mjs';
import { test } from '../src/cli/test.mjs';
import { send } from '../src/cli/send.mjs';
import { listen } from '../src/cli/listen.mjs';
import { initProject } from '../src/cli/init-project.mjs';
import { cleanup } from '../src/cli/cleanup.mjs';
import { guide } from '../src/cli/guide.mjs';
import { scrubSecrets } from '../src/config.mjs';

const commands = {
  setup,
  init: initProject,
  doctor,
  test,
  send,
  listen,
  'init-project': initProject,
  cleanup,
  guide,
};

function usage() {
  console.log(`Telagent

Usage:
  telagent setup
  telagent init [--all|--claude|--codex|--gemini]
  telagent doctor
  telagent test
  telagent guide
  telagent send "message" [--wait-reply]
  telagent listen --reply-to <messageId[,messageId...]>
  telagent init-project [--all|--claude|--codex|--gemini]
  telagent cleanup [--older-than 7d] [--dry-run]
`);
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd || cmd === '-h' || cmd === '--help') {
  usage();
  process.exit(0);
}

const run = commands[cmd];
if (!run) {
  console.error(`Unknown command: ${cmd}`);
  usage();
  process.exit(1);
}

try {
  await run(args);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(scrubSecrets(`Error: ${message}`));
  if (process.env.TELAGENT_DEBUG && error?.stack) console.error(scrubSecrets(error.stack));
  process.exit(1);
}
