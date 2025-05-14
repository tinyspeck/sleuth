import fs from 'fs-extra';
import httpProxy from 'http-proxy';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';

import { version } from './package.json';
import { vendorSignTool } from './tools/vendor-signtool';

const iconDir = path.join(__dirname, 'public/img');

let server: http.Server;
const PORT = 37492;

const options: ForgeConfig = {
  hooks: {
    preMake: async () => {
      // Use signtool.exe from the `node_modules` folder
      await vendorSignTool();

      let dir: string | undefined = undefined;
      try {
        const timestampProxiedProxy = httpProxy.createProxyServer({});

        server = http.createServer((req, res) => {
          return timestampProxiedProxy.web(req, res, {
            target: 'http://timestamp.digicert.com',
          });
        });

        await new Promise((resolve) => {
          server.listen(PORT, () => {
            resolve(null);
          });
          console.log(`server listening on port ${PORT}`);
        });

        dir = await fs.mkdtemp(
          path.resolve(os.tmpdir(), 'slack-builder-folder-'),
        );
      } finally {
        if (dir) await fs.remove(dir);
      }
    },
    postMake: async () => {
      server.close();
      console.log(`server closing`);
    },
  },
  packagerConfig: {
    name: 'Sleuth',
    executableName: process.platform === 'linux' ? 'sleuth' : 'Sleuth',
    icon: './public/img/sleuth-icon',
    appBundleId: 'com.felixrieseberg.sleuth',
    appCategoryType: 'public.app-category.developer-tools',
    asar: {
      unpackDir: '**/cachetool',
    },
    extendInfo: './static/extend.plist',
    win32metadata: {
      ProductName: 'Sleuth',
      CompanyName: 'Slack Technologies, Inc.',
    },
  },
  makers: [
    new MakerSquirrel((arch) => {
      const certThumbPrint = process.env.CERT_THUMBPRINT;
      const intermediateCert = path.resolve(
        __dirname,
        'tools',
        'certs',
        'DigiCertCA2.cer',
      );

      return {
        name: 'sleuth',
        authors: 'Slack Technologies, Inc.',
        exe: 'sleuth.exe',
        noMsi: true,
        setupExe: `sleuth-${version}-${arch}-setup.exe`,
        setupIcon: path.resolve(iconDir, 'sleuth-icon.ico'),
        signWithParams: `/v /debug /a /sm /fd sha256 /sha1 ${certThumbPrint} /tr http://localhost:${PORT} /td sha256 /ac ${intermediateCert}`,
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
