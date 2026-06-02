import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliSrc = path.resolve(__dirname, '../../../integrations/cli/src');

function walkTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walkTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('integrations boundary', () => {
  it('CLI imports only @ship/sdk, not api/src', () => {
    const files = walkTsFiles(cliSrc);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/@ship\/api/);
      expect(content).not.toMatch(/api\/src/);
    }
  });
});
