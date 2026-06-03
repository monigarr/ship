#!/usr/bin/env node
/** Local helper: runs TTFE vitest (same as platform-gates CI). */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const child = spawn(
  'pnpm',
  ['--filter', '@ship/api', 'exec', 'vitest', 'run', 'src/platform/ttfe-ci.test.ts'],
  { stdio: 'inherit', shell: true, cwd: root, env: process.env }
);
child.on('close', (code) => process.exit(code ?? 1));
