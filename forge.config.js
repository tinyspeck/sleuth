/* eslint-disable */
//@ts-check
const path = require("path");

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
      config: (arch) => {
        const certThumbPrint = process.env.CERT_THUMBPRINT;

        return {
          name: "sleuth",
          authors: "Slack Technologies, Inc.",
          exe: "sleuth.exe",
          noMsi: true,
          setupExe: `sleuth-${version}-${arch}-setup.exe`,
          setupIcon: path.resolve(iconDir, "sleuth-icon.ico"),
          signWithParams: `/as /sm /fd sha256 /sha1 ${certThumbPrint}`,
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
