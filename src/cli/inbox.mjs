import { requireConfig } from '../config.mjs';
import { parseFlags } from '../utils.mjs';
import { fetchInbox } from '../runtime.mjs';

async function pollOnce(config, { quiet = false } = {}) {
  const promptFiles = await fetchInbox(config);
  if (!promptFiles.length) {
    if (!quiet) console.log('No Telegram inbox messages.');
    return false;
  }
  for (const file of promptFiles) console.log(`Inbox prompt written to ${file}`);
  return true;
}

export async function inbox(argv = []) {
  const { flags } = parseFlags(argv);
  const config = requireConfig();
  const watch = Boolean(flags.watch || flags.daemon);
  if (!watch) {
    await pollOnce(config);
    return;
  }

  console.log(`Watching Telegram inbox every ${config.pollIntervalMs}ms...`);
  while (true) {
    await pollOnce(config, { quiet: true });
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}
