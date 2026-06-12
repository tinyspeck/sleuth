import { app, BrowserWindow, crashReporter } from 'electron';
import startup from 'electron-squirrel-startup';

// A macOS app launched from Finder/Dock inherits a bare PATH
// (/usr/bin:/bin:/usr/sbin:/sbin) rather than the user's login-shell PATH,
// so the common Homebrew/manual install dirs aren't searched — and the AI
// assistant's `fma-sso-assume-role` binary, which lives there, isn't found.
// Prepend those dirs before anything execs.
if (process.platform === 'darwin') {
  const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin'];
  const current = process.env.PATH ?? '';
  const missing = extraPaths.filter((p) => !current.split(':').includes(p));
  if (missing.length > 0) {
    process.env.PATH = [...missing, current].filter(Boolean).join(':');
  }
}

console.log(`Welcome to Sleuth ${app.getVersion()}`);

import { ipcManager } from './ipc';
import { secureApp } from './security';
import { createWindow, windows } from './windows';
import { createMenu } from './menu';
import { setupUpdates } from './update';
import { installProtocol } from './protocol';
import { registerScheme } from './scheme';

if (app.isPackaged) {
  process.env.NODE_ENV = 'production';
}

if (startup) {
  // No-op, we're done here
} else {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  }

  crashReporter.start({
    uploadToServer: false,
  });

  console.log(`Booting application (ready status: ${app.isReady()})`);

  // Whenever the app has finished launching
  app.on('will-finish-launching', () => {
    app.on('open-file', (event, path) => {
      event.preventDefault();

      function openWhenReady() {
        if (ipcManager && BrowserWindow.getAllWindows().length > 0) {
          ipcManager.openFile(path);
        } else {
          setTimeout(openWhenReady, 500);
        }
      }

      openWhenReady();
    });
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', () => {
    console.log(`App is ready, creating components`);

    secureApp();
    createWindow();
    createMenu();
    setupUpdates();
    registerScheme();
  });

  app.on('web-contents-created', (_event, contents) => {
    if (!app.isPackaged) {
      contents.openDevTools();
    }
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (windows.length === 0) {
      createWindow();
    }
  });

  installProtocol();

  console.log(`Setup all listeners, now waiting for ready event`);
}
