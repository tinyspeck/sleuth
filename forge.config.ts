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

import { version } from './package.json';

const iconDir = path.join(__dirname, 'static/img');

let server: http.Server;
const PORT = 37492;

const options: ForgeConfig = {
  hooks: {
    generateAssets: require('./tools/generateAssets'),
    preMake: async () => {
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
    icon: './static/img/sleuth-icon',
    appBundleId: 'com.felixrieseberg.sleuth',
    appCategoryType: 'public.app-category.developer-tools',
    asar: {
      unpackDir: '**/cachetool',
    },
    ignore: [
      /^\/\.vscode/,
      /^\/catapult/,
      /^\/coverage/,
      /^\/test/,
      /^\/tools/,
      /^\/src\//,
      /^\/static\/catapult-overrides/,
      /^\/static\/img\/sleuth/,
      /\/test\//,
      /\/[A-Za-z0-0]+\.md$/,
      /package-lock.json/,
      /react.development.js/,
    ],
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
  plugins: [new AutoUnpackNativesPlugin({})],
};

export default options;
