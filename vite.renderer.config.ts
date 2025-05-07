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
