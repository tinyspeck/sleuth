import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  css: {
    preprocessorOptions: {
      less: {
        math: 'always',
        relativeUrls: true,
      },
    },
  },
  define: {
    global: {},
  },
  build: {
    sourcemap: 'inline',
  },
});
