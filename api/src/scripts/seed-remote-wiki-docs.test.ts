import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertPathWithinRoot, isSafeDirEntryName } from './seed-remote-wiki-docs.js';

describe('seed-remote-wiki-docs path guards', () => {
  const root = path.resolve('/tmp/root');

  it('allows paths inside the root', () => {
    const inside = path.join(root, 'a.md');
    expect(assertPathWithinRoot(root, inside)).toBe(inside);
  });

  it('rejects paths outside the root', () => {
    expect(() => assertPathWithinRoot(root, path.resolve('/tmp/other.md'))).toThrow(
      /escapes source directory/,
    );
  });

  it('rejects traversal via parent segments', () => {
    expect(() => assertPathWithinRoot(root, path.join(root, '..', 'other'))).toThrow(
      /escapes source directory/,
    );
  });

  it('rejects unsafe directory entry names', () => {
    expect(isSafeDirEntryName('..')).toBe(false);
    expect(isSafeDirEntryName('foo/bar')).toBe(false);
    expect(isSafeDirEntryName('a\\b')).toBe(false);
    expect(isSafeDirEntryName('')).toBe(false);
  });

  it('accepts normal markdown filenames', () => {
    expect(isSafeDirEntryName('README.md')).toBe(true);
  });
});
