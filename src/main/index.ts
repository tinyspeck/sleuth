import { app, BrowserWindow } from 'electron';

console.log(`Welcome to Sleuth ${app.getVersion()}`);

import { config } from '../config';
import { ipcManager } from './ipc';
import { secureApp } from './security';
import { createWindow, windows } from './windows';
import { createMenu } from './menu';
import { setupUpdates } from './update';
import { installProtocol } from './protocol';
import { registerScheme, registerSchemePrivilege } from './scheme';

if (!config.isDevMode) {
  process.env.NODE_ENV = 'production';
}

app.allowRendererProcessReuse = false;

if (require('electron-squirrel-startup')) {
  // No-op, we're done here
} else {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  }

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

  registerSchemePrivilege();

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
