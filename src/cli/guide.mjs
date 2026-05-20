import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../utils.mjs';

export async function guide() {
  const file = path.join(ROOT_DIR, 'rules', 'telegram-guide.md');
  console.log(fs.readFileSync(file, 'utf8'));
}
