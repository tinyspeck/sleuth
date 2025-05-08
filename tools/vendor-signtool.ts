import fs from 'fs-extra';
import path from 'node:path';

export async function vendorSignTool() {
  const windowSdkLocation = `C:\\Program Files (x86)\\Windows Kits\\10\\bin\\${
    process.arch === 'ia32' ? 'x86' : 'x64'
  }`;
  const signTool = path.join(windowSdkLocation, 'signtool.exe');

  if (process.env.CI && process.platform === 'win32') {
    await fs.copy(
      `${signTool}`,
      path.resolve(
        __dirname,
        '../node_modules/electron-winstaller/vendor/signtool.exe',
      ),
    );
  }
}
