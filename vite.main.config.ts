import { defineConfig, UserConfig } from 'vite';
import copy from 'rollup-plugin-copy';

import path from 'node:path';
import fs from 'fs-extra';

const hasSubmodules = fs.existsSync(
  path.join(__dirname, './catapult/netlog_viewer/netlog_viewer'),
);
const isCI = process.env.CI;

if (!hasSubmodules && isCI) {
  console.error(`In CI and missing Catapult`);
  process.exit(1);
} else if (!hasSubmodules) {
  console.warn(`Building WITHOUT catapult!`);
} else {
  console.log('Catapult found');
}

const gitSubmodules = hasSubmodules
  ? [
      {
        src: path.join(__dirname, './catapult/netlog_viewer/netlog_viewer/*'),
        dest: path.join(__dirname, './public/catapult'),
      },
      {
        src: path.join(
          __dirname,
          './catapult/third_party/polymer/components/polymer',
        ),
        dest: path.join(__dirname, './public/catapult'),
      },
      {
        src: path.join(
          __dirname,
          './catapult/third_party/polymer/components/webcomponentsjs',
        ),
        dest: path.join(__dirname, './public/catapult'),
      },
    ]
  : [];

const config: UserConfig = {
  plugins: [
    copy({
      targets: [
        {
          src: path.join(
            __dirname,
            './node_modules/devtools-frontend-prebuilt/front_end/*',
          ),
          dest: path.join(__dirname, './.vite/devtools-frontend'),
        },
        {
          src: path.join(__dirname, './static/devtools-frontend.html'),
          dest: path.join(__dirname, './.vite'),
        },
        ...gitSubmodules,
        {
          src: path.join(__dirname, './static/catapult-overrides/*'),
          dest: path.join(__dirname, './public/catapult'),
        },
      ],
    }),
  ],
};

export default defineConfig(config);
