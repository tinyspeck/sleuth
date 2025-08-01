import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    react({
      babel: {
        parserOpts: {
          plugins: ['decorators-legacy', 'classProperties'],
        },
      },
    }),
  ],
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
    copyPublicDir: true,
    rollupOptions: {
      onwarn(warning, warn) {
        // Module level directives cause errors when bundled, "use client" in "node_modules/antd/es/color-picker/components/ColorHexInput.js" was ignored.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        } else {
          warn(warning);
        }
      },
    },
  },
});
