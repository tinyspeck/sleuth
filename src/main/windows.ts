import { app, BrowserWindow } from 'electron';
import installExtension, {
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';
import windowStateKeeper from 'electron-window-state';

import { settingsFileManager } from './settings';
import { getIconPath } from './app-icon';
import { ICON_NAMES } from '../shared-constants';
import { TouchBarManager } from './touch-bar-manager';
import path from 'node:path';

export let windows: Array<Electron.BrowserWindow> = [];

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  manage: (window: BrowserWindow) => void;
  unmanage: () => void;
}

/**
 * Get a window position
 *
 * @returns {WindowState}
 */
function getWindowState() {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  }) as WindowState;

  let x = mainWindowState.x;
  let y = mainWindowState.y;

  // If creating additional windows, move them a little
  if (windows.length > 0) {
    const pos = windows[windows.length - 1].getBounds();

    x = pos.x + 15;
    y = pos.y + 15;
  }

  return {
    mainWindowState,
    x,
    y,
  };
}

/**
 * Create a main window
 *
 * @returns {Promise<BrowserWindow>}
 */
export async function createWindow(): Promise<BrowserWindow> {
  console.log(`Creating window. Current number of windows: ${windows.length}`);

  // Let's keep the window position in mind
  const { mainWindowState, x, y } = getWindowState();

  // We might want a custom window
  const icon =
    process.platform !== 'darwin' &&
    !!(await settingsFileManager.getItem('isMarkIcon'))
      ? getIconPath(ICON_NAMES.mark)
      : getIconPath(ICON_NAMES.default);

  // Create the browser window.
  const options: Electron.BrowserWindowConstructorOptions = {
    x,
    y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    show: !app.isPackaged,
    icon: process.platform !== 'darwin' ? icon : undefined,
    minHeight: 500,
    minWidth: 1170,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    webPreferences: {
      webviewTag: false,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  };
  console.log(`Windows: Creating window with options`, options);

  const mainWindow = new BrowserWindow(options);

  mainWindowState.manage(mainWindow);

  // Add a TouchBarManager. It'll take care of the touch bar.
  // We don't _really_ get to add things to the window, but
  // I'm doing it anyway.
  if (process.platform === 'darwin') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mainWindow as any).touchBarManager = new TouchBarManager(mainWindow);
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  if (!app.isPackaged) {
    await installExtension(REACT_DEVELOPER_TOOLS, {
      loadExtensionOptions: {
        allowFileAccess: true,
      },
    });
  }

  windows.push(mainWindow);

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    // windows.(mainWindow);
    windows = windows.filter((w) => w !== mainWindow);
  });

  console.log(`Created window. Current window size: ${windows.length}`);

  return mainWindow;
}

/**
 * Get the main window
 *
 * @export
 * @returns {Promise<BrowserWindow>}
 */
export async function getCurrentWindow(): Promise<BrowserWindow> {
  // If a window is focused, return that one
  const focused = BrowserWindow.getFocusedWindow();

  if (focused) {
    return focused;
  }

  // None ready or focused? The first one then.
  if (windows && windows.length > 0) {
    return windows[0];
  }

  // Wow, no windows? Make one
  await createWindow();
  return getCurrentWindow();
}
