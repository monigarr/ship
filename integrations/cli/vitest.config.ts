import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ship/sdk': path.resolve(__dirname, '../../sdk/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.ts'],
  },
});
