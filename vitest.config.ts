/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    pool: 'forks',
    environment: 'node',
  },
});
