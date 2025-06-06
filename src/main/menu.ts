import {
  app,
  dialog,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
} from 'electron';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import { promisify } from 'util';
import { format } from 'date-fns';
import debug from 'debug';

import { getCurrentWindow } from './windows';
import { getMenuTemplate } from './menu-template';
import { IpcEvents } from '../ipc-events';

const d = debug('sleuth:menu');

export class AppMenu {
  private productionLogs: string;
  private devEnvLogs: string;
  private devModeLogs: string;
  private productionLogsExist: boolean;
  private devEnvLogsExist: boolean;
  private devModeLogsExist: boolean;
  private productionCacheExist: boolean;
  private devEnvCacheExist: boolean;
  private devModeCacheExist: boolean;
  private menu: (MenuItem | MenuItemConstructorOptions)[] | null = null;

  constructor() {
    const appData = app.getPath('appData');

    // Logs
    this.productionLogs = path.join(appData, `Slack`, 'logs');
    this.devEnvLogs = path.join(appData, `SlackDevEnv`, 'logs');
    this.devModeLogs = path.join(appData, `SlackDevMode`, 'logs');
    this.productionLogsExist = fs.existsSync(this.productionLogs);
    this.devEnvLogsExist = fs.existsSync(this.devEnvLogs);
    this.devModeLogsExist = fs.existsSync(this.devModeLogs);

    // Cache
    this.productionCacheExist = fs.existsSync(this.productionLogs);
    this.devEnvCacheExist = fs.existsSync(this.devEnvLogs);
    this.devModeCacheExist = fs.existsSync(this.devModeLogs);

    this.setupMenu();
  }

  /**`
   * Returns a MenuItemOption for a given Slack logs location.
   *
   * @param {('' | 'DevEnv' | 'DevMode')} [type='']
   * @returns {Electron.MenuItemOptions}
   */
  public getOpenItem(
    type: '' | 'DevEnv' | 'DevMode' = '',
  ): MenuItemConstructorOptions {
    const appData = app.getPath('appData');
    const logsPath = path.join(appData, `Slack${type}`, 'logs');
    const storagePath = path.join(appData, `Slack${type}`, 'storage');

    return {
      label: `Open local Slack${type} logs...`,
      click: async () => {
        let files: Array<string> = [];

        try {
          files = await fs.readdir(logsPath);
        } catch (error) {
          d(`Tried to read logs directory, but failed`, { error });
        }

        if (files && files.length > 0) {
          const { webContents } = await getCurrentWindow();
          const name = `Local Slack${type} Logs - ${format(
            Date.now(),
            `MMM d, y HH.mm.SSSS`,
          )}`;
          const tmpOptions: tmp.DirOptions = { unsafeCleanup: true, name };
          //@ts-expect-error promisify type doesn't expect the correct number of arguments
          const tmpdir = await promisify(tmp.dir)(tmpOptions);

          await fs.copy(logsPath, tmpdir);
          await fs.copy(storagePath, tmpdir);

          webContents.send(IpcEvents.FILE_DROPPED, tmpdir);
        } else {
          dialog.showMessageBox({
            type: 'error',
            title: 'Could not find local Slack logs',
            message: `We attempted to find your local Slack's logs, but we couldn't find them. We checked for them in ${logsPath}.`,
          });
        }
      },
    };
  }

  /**
   * Checks what kind of Slack logs are locally available and returns an array
   * with appropriate items.
   *
   * @returns {Array<Electron.MenuItemOptions>}
   */
  public getOpenItems(): Array<Electron.MenuItemConstructorOptions> {
    const openItem = {
      label: 'Open...',
      accelerator: 'CmdOrCtrl+O',
      click: async () => {
        try {
          const { filePaths } = await dialog.showOpenDialog({
            defaultPath: app.getPath('downloads'),
            filters: [{ name: 'zip', extensions: ['zip'] }],
            properties: ['openFile', 'openDirectory', 'showHiddenFiles'],
          });

          await this.handleFilePaths(filePaths);
        } catch (error) {
          d(`Failed to open item. ${error}`);
        }
      },
    };

    const openRecentItem = {
      label: 'Open Recent',
      role: 'recentDocuments' as const,
      submenu: [
        {
          label: 'Clear Recent',
          role: 'clearRecentDocuments' as const,
        },
      ],
    };

    const openItems: Array<Electron.MenuItemConstructorOptions> = [
      openItem,
      openRecentItem,
    ];

    // Windows and Linux don't understand combo dialogs
    if (process.platform !== 'darwin') {
      openItem.label = 'Open Folder...';

      // Make a new one
      const openFile = {
        label: 'Open File...',
        accelerator: 'CmdOrCtrl+Shift+O',
        click: async () => {
          const { filePaths } = await dialog.showOpenDialog({
            defaultPath: app.getPath('downloads'),
            filters: [{ name: 'zip', extensions: ['zip'] }],
            properties: ['openFile', 'showHiddenFiles'],
          });

          await this.handleFilePaths(filePaths);
        },
      };

      openItems.push(openFile);
    }

    if (
      this.productionLogsExist ||
      this.devEnvLogsExist ||
      this.devModeLogsExist
    ) {
      openItems.push({ type: 'separator' });
    }

    if (this.productionLogsExist) openItems.push(this.getOpenItem());
    if (this.devEnvLogsExist) openItems.push(this.getOpenItem('DevEnv'));
    if (this.devModeLogsExist) openItems.push(this.getOpenItem('DevMode'));

    return openItems;
  }

  /**
   * Get "Prune ..." items
   */
  public getPruneItems(): Array<Electron.MenuItemConstructorOptions> {
    const getPruneItem = (name: string, targetPath: string) => ({
      label: `Prune ${name}`,
      click: async () => {
        try {
          fs.emptyDir(targetPath);
        } catch (error) {
          dialog.showMessageBox({
            type: 'error',
            title: 'Could not prune logs',
            message: `We attempted to prune logs at ${targetPath}, but failed with the following error: "${error}".`,
          });
        }
      },
    });

    const result: { label: string; click: () => Promise<void> }[] = [];

    if (this.productionLogsExist) {
      result.push(getPruneItem('Slack Logs (Production)', this.productionLogs));
    }

    if (this.devModeLogsExist) {
      result.push(getPruneItem('Slack Logs (DevMode)', this.devModeLogs));
    }

    if (this.devEnvLogsExist) {
      result.push(getPruneItem('Slack Logs (DevEnv)', this.devEnvLogs));
    }

    return result;
  }

  /**
   * Actually creates the menu.
   */
  public setupMenu() {
    this.menu = getMenuTemplate({
      openItems: this.getOpenItems(),
      pruneItems: this.getPruneItems(),
    });

    Menu.setApplicationMenu(Menu.buildFromTemplate(this.menu));
  }

  private async handleFilePaths(filePaths: Array<string>): Promise<void> {
    if (filePaths && filePaths.length > 0) {
      const { webContents } = await getCurrentWindow();
      app.addRecentDocument(filePaths[0]);
      webContents.send(IpcEvents.FILE_DROPPED, filePaths[0]);
    }
  }
}

let menu: AppMenu | undefined;

export function createMenu() {
  menu = menu || new AppMenu();
}
