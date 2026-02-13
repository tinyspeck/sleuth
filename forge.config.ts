import path from 'node:path';

import type {
  ForgeConfig,
  ForgeMakeResult,
} from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';

import { version } from './package.json';
import { signFileWithJsign } from './tools/sign-with-jsign';

const iconDir = path.join(__dirname, 'public/img');

const options: ForgeConfig = {
  hooks: {
    postMake: async (
      _forgeConfig: ForgeConfig,
      makeResults: ForgeMakeResult[],
    ) => {
      // Sign Windows artifacts with AWS KMS using jsign
      if (process.platform === 'win32') {
        for (const result of makeResults) {
          for (const artifact of result.artifacts) {
            if (artifact.endsWith('.exe')) {
              const signResult = await signFileWithJsign(artifact);
              if (!signResult.success) {
                throw new Error(
                  `Failed to sign ${artifact}: ${signResult.error}`,
                );
              }
            }
          }
        }
      }
      return makeResults;
    },
  },
  packagerConfig: {
    name: 'Sleuth',
    executableName: process.platform === 'linux' ? 'sleuth' : 'Sleuth',
    icon: './public/img/sleuth-icon',
    appBundleId: 'com.felixrieseberg.sleuth',
    appCategoryType: 'public.app-category.developer-tools',
    asar: true,
    extendInfo: './static/extend.plist',
    win32metadata: {
      ProductName: 'Sleuth',
      CompanyName: 'Slack Technologies, Inc.',
    },
  },
  makers: [
    new MakerSquirrel((arch) => {
      return {
        name: 'sleuth',
        authors: 'Slack Technologies, Inc.',
        exe: 'sleuth.exe',
        noMsi: true,
        setupExe: `sleuth-${version}-${arch}-setup.exe`,
        setupIcon: path.resolve(iconDir, 'sleuth-icon.ico'),
        // Signing is handled in postMake hook using jsign with AWS KMS
      };
    }),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({}, ['linux']),
    new MakerRpm({}, ['linux']),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'tinyspeck',
        name: 'sleuth',
      },
      prerelease: false,
      draft: true,
      authToken: process.env.SLACK_GH_RELEASE_TOKEN,
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: './src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: './src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new AutoUnpackNativesPlugin({}),
  ],
};

export default options;
