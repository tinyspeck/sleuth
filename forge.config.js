/* eslint-disable */
//@ts-check
const fs = require("fs-extra");
const os = require("os");
const path = require("path");

const iconDir = path.join(__dirname, "static/img");
const version = require("./package.json").version;

const http = require("http");
const httpProxy = require("http-proxy");

let server;
const PORT = 37492;

const options = {
  hooks: {
    generateAssets: require("./tools/generateAssets"),
    preMake: async () => {
      let server = null;
      let dir = null;
      try {
        const timestampProxiedProxy = httpProxy.createProxyServer({});

        server = http.createServer((req, res) => {
          return timestampProxiedProxy.web(req, res, {
            target: "http://timestamp.digicert.com",
          });
        });

        await new Promise((resolve) => {
          server.listen(PORT, () => {
            resolve(null);
          });
          console.log(`server listening on port ${PORT}`);
        });

        dir = await fs.mkdtemp(
          path.resolve(os.tmpdir(), "slack-builder-folder-")
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
    name: "Sleuth",
    executableName: process.platform === "linux" ? "sleuth" : "Sleuth",
    icon: "./static/img/sleuth-icon",
    appBundleId: "com.felixrieseberg.sleuth",
    appCategoryType: "public.app-category.developer-tools",
    asar: {
      unpackDir: "**/cachetool",
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
    extendInfo: "./static/extend.plist",
    win32metadata: {
      ProductName: "Sleuth",
      CompanyName: "Slack Technologies, Inc.",
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: (arch) => {
        const certThumbPrint = process.env.CERT_THUMBPRINT;

        return {
          name: "sleuth",
          authors: "Slack Technologies, Inc.",
          exe: "sleuth.exe",
          noMsi: true,
          setupExe: `sleuth-${version}-${arch}-setup.exe`,
          setupIcon: path.resolve(iconDir, "sleuth-icon.ico"),
          signWithParams: `/a /sm /fd sha256 /sha1 ${certThumbPrint} /tr http://localhost:${PORT} /td sha256`,
        };
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
    },
    {
      name: "@electron-forge/maker-rpm",
      platforms: ["linux"],
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "tinyspeck",
          name: "sleuth",
        },
        prerelease: false,
        draft: true,
        authToken: process.env.SLACK_GH_RELEASE_TOKEN,
      },
    },
  ],
  plugins: [["@electron-forge/plugin-auto-unpack-natives"]],
};

module.exports = options;
