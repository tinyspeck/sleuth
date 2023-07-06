/* eslint-disable */
const fs = require('fs-extra');
const path = require('path');

const { compileParcel } = require('./parcel-build');
const { copyCatapult } = require('./copy-catapult');
const { copyDevtoolsFrontend } = require('./copy-devtools-frontend');

const windowSdkLocation = `C:\\Program Files (x86)\\Windows Kits\\10\\bin\\${
  process.arch === 'ia32' ? 'x86' : 'x64'
}`;
const signTool = path.join(windowSdkLocation, 'signtool.exe');

module.exports = async () => {
  await Promise.all([ compileParcel({ production: true }), copyCatapult(), copyDevtoolsFrontend()]);
  if (process.env.CI) {
    await fs.copy(
      `${signTool}`,
      path.resolve(__dirname, '../node_modules/electron-winstaller/vendor/signtool.exe')
    );
  }
}
