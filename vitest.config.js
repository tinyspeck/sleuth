import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/vitest-setup.js'],
    include: ['test/**/*.test.[jt]s?(x)'],
    css: true,
  },
});
