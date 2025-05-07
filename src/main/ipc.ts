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
  nativeTheme,
  clipboard,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';

import { settingsFileManager } from './settings';
import { changeIcon } from './app-icon';
import { ICON_NAMES } from '../shared-constants';
import { IpcEvents } from '../ipc-events';
import {
  LogLineContextMenuActions,
  LogType,
  UnzippedFile,
} from '../interfaces';
import { ColorTheme } from '../renderer/components/preferences';
import { Unzipper } from './unzip';
import { openFile } from './filesystem/open-file';
import {
  deleteSuggestion,
  deleteSuggestions,
  getItemsInSuggestionFolders,
} from './filesystem/suggestions';
import { readLogFile, readStateFile } from './filesystem/read-file';
import { getSentryHref } from '../renderer/sentry';
import { download, getHeaders, getData } from './cachetool';
import { openLineInSource } from './open-line-in-source';

fs.watch(app.getPath('downloads'), async () => {
  const suggestions = await getItemsInSuggestionFolders();
  getCurrentWindow().webContents.send(
    IpcEvents.SUGGESTIONS_UPDATED,
    suggestions,
  );
});

function getCurrentWindow(): Electron.BrowserWindow {
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
    this.setupNativeTheme();
    this.setupUnzipper();
    this.setupOpenFile();
    this.setupSuggestions();
    this.setupProcessor();
    this.setupOpenSentry();
    this.setupCachetool();
    this.setupLogFileContextMenu();
  }

  public openFile(pathName: string) {
    getCurrentWindow().webContents.send(IpcEvents.FILE_DROPPED, pathName);
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
    ipcMain.handle(
      IpcEvents.SET_SETTINGS,
      (_event, key: string, value: unknown) =>
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

  private setupNativeTheme() {
    /**
     * `nativeTheme.themeSource` can be one of `light`, `dark`, or `system`.
     * Follow OS --> themeSource = 'system'
     * Dark Mode --> themeSource = 'dark'
     * Light Mode --> themeSource = 'light'
     *
     * This handler returns whether or not the UI should be in dark mode
     * according to the user's settings.
     */
    ipcMain.handle(
      IpcEvents.SET_COLOR_THEME,
      async (_, colorTheme: ColorTheme) => {
        nativeTheme.themeSource = colorTheme;
        return nativeTheme.shouldUseDarkColors;
      },
    );

    /**
     * We also need to listen to changes to the dark mode settings that
     * are coming from the OS. This listener will tell all renderers
     * whether or not to set the UI to dark mode or not.
     */
    nativeTheme.on('updated', () => {
      const wins = BrowserWindow.getAllWindows();

      for (const win of wins) {
        win.webContents.send(
          IpcEvents.DARK_MODE_UPDATE,
          nativeTheme.shouldUseDarkColors,
        );
      }
    });
  }

  /**
   * Set up unzipping in the main process
   */
  private setupUnzipper() {
    ipcMain.handle(IpcEvents.UNZIP, async (_event, url: string) => {
      const unzipper = new Unzipper(url);
      await unzipper.open();

      return await unzipper.unzip();
    });
  }

  private setupOpenFile() {
    ipcMain.handle(IpcEvents.OPEN_FILE, async (_event, filePath: string) => {
      return openFile(filePath);
    });
  }

  private setupSuggestions() {
    ipcMain.handle(IpcEvents.GET_SUGGESTIONS, async (_event) => {
      return getItemsInSuggestionFolders();
    });

    ipcMain.handle(
      IpcEvents.DELETE_SUGGESTION,
      async (_event, filePath: string) => {
        return deleteSuggestion(filePath);
      },
    );

    ipcMain.handle(
      IpcEvents.DELETE_SUGGESTIONS,
      async (_event, filePaths: string[]) => {
        return deleteSuggestions(filePaths);
      },
    );
  }

  private setupProcessor() {
    ipcMain.handle(IpcEvents.READ_LOG_FILE, async (_event, files) => {
      return readLogFile(files);
    });
    ipcMain.handle(
      IpcEvents.READ_STATE_FILE,
      async (_event, file: UnzippedFile) => {
        return readStateFile(file);
      },
    );
    ipcMain.handle(
      IpcEvents.READ_ANY_FILE,
      async (_event, file: UnzippedFile) => {
        console.log('Reading file', file.fullPath);
        return fs.promises.readFile(file.fullPath, 'utf8');
      },
    );
  }

  private setupOpenSentry() {
    ipcMain.on(
      IpcEvents.OPEN_SENTRY,
      async (_event, installationFilePath: string) => {
        // No file? Do nothing
        if (!installationFilePath) {
          await dialog.showMessageBox({
            title: 'No installation id found',
            message:
              'We did not find an installation id in this set of logs and can therefore not look for crashes for this user.',
          });

          return;
        }

        // Read the data
        const data = await fs.promises.readFile(installationFilePath, 'utf8');
        const id = atob(data);

        if (id) {
          shell.openExternal(getSentryHref(id));
        }
      },
    );
  }

  private setupCachetool() {
    ipcMain.handle(
      IpcEvents.CACHETOOL_DOWNLOAD,
      async (_event, dataPath: string) => {
        return download(dataPath);
      },
    );
    ipcMain.handle(
      IpcEvents.CACHETOOL_GET_HEADERS,
      async (_event, cachePath: string, key: string) => {
        return getHeaders(cachePath, key);
      },
    );
    ipcMain.handle(
      IpcEvents.CACHETOOL_GET_DATA,
      async (_event, cachePath: string, key: string) => {
        return getData(cachePath, key);
      },
    );
  }

  private setupLogFileContextMenu() {
    ipcMain.handle(
      IpcEvents.OPEN_LINE_IN_SOURCE,
      (
        _event,
        line: number,
        sourceFile: string,
        options: {
          defaultEditor: string;
        },
      ) => {
        openLineInSource(line, sourceFile, options);
      },
    );
  }
}

export const ipcManager = new IpcManager();
