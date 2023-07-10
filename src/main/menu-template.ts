import { app, BrowserWindow, MenuItem, shell } from 'electron';
import { createWindow, getCurrentWindow } from './windows';
import { IpcEvents } from '../ipc-events';

export interface MenuTemplateOptions {
  pruneItems: Array<Electron.MenuItemConstructorOptions>;
  openItems: Array<Electron.MenuItemConstructorOptions>;
}

export function getMenuTemplate(options: MenuTemplateOptions) {
  const template: Array<
    Electron.MenuItemConstructorOptions | Electron.MenuItem
  > = [
    {
      label: 'Edit',
      submenu: [
        {
          role: 'cut',
        },
        {
          role: 'copy',
        },
        {
          role: 'paste',
        },
        {
          role: 'selectAll',
        },
        {
          type: 'separator',
        },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click(_item: Electron.MenuItem, browserWindow: BrowserWindow) {
            browserWindow.webContents.send(IpcEvents.FIND);
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click(_item: MenuItem, focusedWindow: BrowserWindow) {
            if (focusedWindow) focusedWindow.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: (function () {
            if (process.platform === 'darwin') return 'Ctrl+Command+F';
            else return 'F11';
          })(),
          click(_item: MenuItem, focusedWindow: BrowserWindow) {
            if (focusedWindow)
              focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: (function () {
            if (process.platform === 'darwin') return 'Option+Command+I';
            else return 'Ctrl+Shift+I';
          })(),
          click(_item: MenuItem, focusedWindow: BrowserWindow) {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          },
        },
        {
          type: 'separator',
        },
        {
          role: 'zoomIn',
          accelerator: 'CmdOrCtrl+Plus',
        },
        {
          role: 'zoomIn',
          accelerator: 'CmdOrCtrl+=',
          acceleratorWorksWhenHidden: true,
          visible: false,
        },
        {
          role: 'zoomOut',
          accelerator: 'CmdOrCtrl+-',
        },
        {
          role: 'resetZoom',
        },
        {
          type: 'separator',
        },
        {
          label: 'Show Omnibar',
          accelerator: 'CmdOrCtrl+K',
          click(_item: Electron.MenuItem, browserWindow: BrowserWindow) {
            browserWindow.webContents.send(IpcEvents.TOGGLE_SPOTLIGHT);
          },
        },
      ],
    },
    {
      label: 'Window',
      role: 'window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize',
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          role: 'close',
        },
      ],
    },
    {
      label: 'Utilities',
      submenu: [
        {
          label: 'Open Sentry',
          click(_item: Electron.MenuItem, browserWindow: BrowserWindow) {
            browserWindow.webContents.send(IpcEvents.OPEN_SENTRY);
          },
        },
        { type: 'separator' },
        ...options.pruneItems,
      ],
    },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Slack Channel',
          click() {
            shell.openExternal(
              'https://slack-pde.slack.com/archives/C8EH27UDT'
            );
          },
        },
        {
          label: 'FAQ',
          click() {
            shell.openExternal('https://corp.quip.com/feaLAxYxU4st/Sleuth-FAQ');
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'GitHub Repository',
          click() {
            shell.openExternal('https://github.com/tinyspeck/sleuth');
          },
        },
      ],
    },
  ];

  const preferencesItem = {
    label: 'Preferences',
    accelerator: 'CmdOrCtrl+,',
    click: async () => {
      const { webContents } = await getCurrentWindow();
      webContents.send(IpcEvents.PREFERENCES_SHOW);
    },
  };

  const newWindowItem = {
    label: 'New Window',
    accelerator: 'CmdOrCtrl+N',
    click: () => createWindow(),
  };

  const newAndOpenItems: Array<Electron.MenuItemConstructorOptions> = [
    newWindowItem,
    { type: 'separator' },
    ...options.openItems,
  ];

  if (process.platform === 'darwin') {
    const { name } = app;

    template.unshift(
      {
        label: name,
        submenu: [
          {
            label: 'About ' + name,
            role: 'about',
          },
          preferencesItem,
          {
            type: 'separator',
          },
          {
            label: 'Services',
            role: 'services',
            submenu: [],
          },
          {
            type: 'separator',
          },
          {
            label: 'Hide ' + name,
            accelerator: 'Command+H',
            role: 'hide',
          },
          {
            label: 'Hide Others',
            accelerator: 'Command+Shift+H',
            role: 'hideOthers',
          },
          {
            label: 'Show All',
            role: 'unhide',
          },
          {
            type: 'separator',
          },
          {
            label: 'Quit',
            accelerator: 'Command+Q',
            click() {
              app.quit();
            },
          },
        ],
      },
      {
        label: 'File',
        submenu: newAndOpenItems,
      }
    );
  } else {
    const windowsLinuxSubmenu: Array<Electron.MenuItemConstructorOptions> = [
      ...newAndOpenItems,
      { type: 'separator' },
      preferencesItem,
    ];

    template.unshift({ label: 'File', submenu: windowsLinuxSubmenu });
  }

  return template;
}
