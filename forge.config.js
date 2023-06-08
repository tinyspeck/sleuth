/* eslint-disable */
//@ts-check
const fs = require("fs-extra");
const path = require("path");
const {
  withWindowsSigningContext,
} = require("./tools/windows-signing-context");

const iconDir = path.join(__dirname, "static/img");
const version = require("./package.json").version;

const options = {
  hooks: {
    generateAssets: require("./tools/generateAssets"),
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
      config: async (arch) => {
        return await withWindowsSigningContext(async (proxiedTimestampUrl) => {
          const certThumbPrint = process.env.CERT_THUMBPRINT;

          // The default location for the Windows Kit. If later versions are installed, they
          // might be in a different folder (like Windows Kits\10\10.5.1234\bin), but we'll
          // go with the "initial release" SDK for now.
          const windowSdkLocation = `C:\\Program Files (x86)\\Windows Kits\\10\\bin\\${
            process.arch === "ia32" ? "x86" : "x64"
          }`;
          const signTool = path.join(windowSdkLocation, "signtool.exe");

          await fs.copy(
            `${signTool}`,
            path.resolve(
              __dirname,
              "../node_modules/electron-winstaller/vendor/signtool.exe"
            )
          );

          return {
            name: "sleuth",
            authors: "Slack Technologies, Inc.",
            exe: "sleuth.exe",
            noMsi: true,
            setupExe: `sleuth-${version}-${arch}-setup.exe`,
            setupIcon: path.resolve(iconDir, "sleuth-icon.ico"),
            signWithParams: `/a /sm /fd sha256 /sha1 ${certThumbPrint} /tr ${proxiedTimestampUrl} /td sha256`,
          };
        });
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
