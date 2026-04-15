import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    copyPublicDir: false,
    rollupOptions: {
      output: {
        sourcemap: process.env.NODE_ENV === 'development',
      },
    },
  },
});
