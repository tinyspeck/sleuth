import {
  shell,
  BrowserWindow,
  app,
  ipcMain,
  dialog,
  systemPreferences,
  IpcMainEvent,
  Menu,
  MenuItemConstructorOptions,
} from 'electron';
import * as path from 'path';

import { settingsFileManager } from './settings';
import { changeIcon } from './app-icon';
import { ICON_NAMES } from '../shared-constants';
import { IpcEvents } from '../ipc-events';
import { LogLineContextMenuActions, LogType } from '../interfaces';

export class IpcManager {
  constructor() {
    this.setupFileDrop();
    this.setupMessageBoxHandler();
    this.setupWindowReady();
    this.setupGetPath();
    this.setupGetUserAgent();
    this.setupSettings();
    this.setupOpenDialog();
    this.setupSaveDialog();
    this.setupQuit();
    this.setupOpenRecent();
    this.setupTitleBarClickMac();
    this.setupContextMenus();
  }

  public openFile(pathName: string) {
    this.getCurrentWindow().webContents.send(IpcEvents.FILE_DROPPED, pathName);
  }

  private getCurrentWindow(): Electron.BrowserWindow {
    const window = BrowserWindow.getFocusedWindow();

    if (window) {
      return window;
    } else {
      const windows = BrowserWindow.getAllWindows();

      if (windows.length > 0) {
        return windows[0];
      } else {
        throw new Error('Could not find window!');
      }
    }
  }

  private setupFileDrop() {
    app.on('browser-window-created', (_e, window) => {
      const parent = window.getParentWindow();

      if (parent) {
        return;
      }

      window.webContents.on('will-navigate', (e, url) => {
        e.preventDefault();

        if (!url.startsWith('file:///')) {
          shell.openExternal(url);
        } else {
          this.openFile(decodeURIComponent(url.replace('file:///', '/')));
        }
      });
    });
  }

  private setupWindowReady() {
    ipcMain.on(IpcEvents.WINDOW_READY, (event) => {
      try {
        const browserWindow = BrowserWindow.fromWebContents(event.sender);

        if (browserWindow) {
          browserWindow.show();
        }
      } catch (error) {
        console.warn(`Could not show window`, error);
      }
    });
  }

  // On macOS, set up titlebar click handler
  private setupTitleBarClickMac() {
    if (process.platform !== 'darwin') {
      return;
    }

    ipcMain.on(IpcEvents.CLICK_TITLEBAR_MAC, (event: IpcMainEvent) => {
      try {
        const doubleClickAction = systemPreferences.getUserDefault(
          'AppleActionOnDoubleClick',
          'string',
        );
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
          if (doubleClickAction === 'Minimize') {
            win.minimize();
          } else if (doubleClickAction === 'Maximize') {
            if (!win.isMaximized()) {
              win.maximize();
            } else {
              win.unmaximize();
            }
          }
        }
      } catch (error) {
        console.error('Couldnt minimize or maximize', error);
      }
    });
  }

  private setupMessageBoxHandler() {
    ipcMain.handle(
      IpcEvents.MESSAGE_BOX,
      async (_event, options: Electron.MessageBoxOptions) => {
        return dialog.showMessageBox(options);
      },
    );
  }

  private setupGetPath() {
    ipcMain.handle(
      IpcEvents.GET_PATH,
      (_event, pathName: Parameters<typeof app.getPath>[0]) => {
        return app.getPath(pathName);
      },
    );
  }

  private setupGetUserAgent() {
    ipcMain.handle(IpcEvents.GET_USER_AGENT, (_event) => {
      return `sleuth/${app.getVersion()}`;
    });
  }

  private setupSettings() {
    ipcMain.handle(IpcEvents.SET_SETTINGS, (_event, key: string, value: any) =>
      settingsFileManager.setItem(key, value),
    );
    ipcMain.handle(IpcEvents.CHANGE_ICON, (_event, iconName: ICON_NAMES) =>
      changeIcon(iconName),
    );
  }

  private setupOpenDialog() {
    ipcMain.handle(IpcEvents.SHOW_OPEN_DIALOG, async (event) => {
      const window = BrowserWindow.fromWebContents(event.sender);

      if (!window)
        return {
          filePaths: [],
        };

      return dialog.showOpenDialog(window, {
        defaultPath: app.getPath('downloads'),
        properties: ['openDirectory'],
      });
    });
  }

  private setupSaveDialog() {
    ipcMain.handle(
      IpcEvents.SHOW_SAVE_DIALOG,
      async (event, filename: string) => {
        const window = BrowserWindow.fromWebContents(event.sender);

        if (!window)
          return {
            filePaths: [],
          };

        return dialog.showSaveDialog(window, {
          defaultPath: path.join(app.getPath('downloads'), filename),
          properties: ['createDirectory'],
        });
      },
    );
  }

  private setupQuit() {
    ipcMain.handle(IpcEvents.QUIT, () => app.quit());
  }

  private setupOpenRecent() {
    ipcMain.on(IpcEvents.ADD_RECENT_FILE, (_event, filename) => {
      app.addRecentDocument(filename);
    });
  }

  private setupContextMenus() {
    ipcMain.handle(IpcEvents.OPEN_LOG_CONTEXT_MENU, (event, type: LogType) => {
      return new Promise((resolve) => {
        console.log(type);
        const maybeShowInContext: MenuItemConstructorOptions[] =
          type === LogType.BROWSER || type === LogType.WEBAPP
            ? [
                {
                  type: 'separator',
                },
                {
                  label: 'Show in "All Desktop Logs"',
                  click: () => {
                    resolve(LogLineContextMenuActions.SHOW_IN_CONTEXT);
                  },
                },
              ]
            : [];

        const menu = Menu.buildFromTemplate([
          {
            label: 'Copy Line',
            click: () => {
              resolve(LogLineContextMenuActions.COPY_TO_CLIPBOARD);
            },
          },
          {
            label: 'Show Line in Source',
            click: () => {
              resolve(LogLineContextMenuActions.OPEN_SOURCE);
            },
          },
          ...maybeShowInContext,
        ]);
        menu.popup({
          window: BrowserWindow.fromWebContents(event.sender) || undefined,
          callback: () => {
            resolve(undefined);
          },
        });
      });
    });
  }
}

export const ipcManager = new IpcManager();
