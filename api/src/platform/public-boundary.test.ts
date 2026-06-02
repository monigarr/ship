import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicRoutesDir = path.join(__dirname, 'routes');

function collectTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('public/internal boundary', () => {
  it('prevents /api/v1 route files from importing legacy internal route handlers', () => {
    const files = collectTsFiles(publicRoutesDir);
    const violations: Array<{ file: string; importPath: string }> = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const importRegex = /from\s+['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null = importRegex.exec(content);
      while (match) {
        const importPath = match[1];
        if (!importPath) {
          match = importRegex.exec(content);
          continue;
        }
        const isRelative = importPath.startsWith('.');
        if (isRelative) {
          const resolved = path.resolve(path.dirname(filePath), importPath);
          const relativeToApiSrc = path.relative(projectRoot, resolved).replace(/\\/g, '/');
          if (relativeToApiSrc.startsWith('routes/')) {
            violations.push({
              file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
              importPath,
            });
          }
        } else if (importPath.includes('/routes/')) {
          violations.push({
            file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
            importPath,
          });
        }
        match = importRegex.exec(content);
      }
    }

    expect(violations).toEqual([]);
  });
});
