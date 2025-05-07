import path from 'node:path';

import fs from 'node:fs';
import { IpcEvents } from '../ipc-events';
import { ICON_NAMES } from '../shared-constants';
import {
  LevelFilter,
  LogLevel,
  LogLineContextMenuActions,
  LogType,
  Suggestion,
  TouchBarLogFileUpdate,
  UnzippedFile,
} from '../interfaces';
import { ReadFileResult } from '../main/filesystem/read-file';
import { ColorTheme } from '../renderer/components/preferences';
import {
  clipboard,
  shell,
  ipcRenderer,
  webUtils,
  contextBridge,
  app,
} from 'electron';

const packageJSON = JSON.parse(
  fs
    .readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')
    .trim(),
);

/**
 * This is a temporary implementation of the preload script while nodeIntegration
 * is still enabled. This provides a familiar `window.Sleuth` interface to the global
 * scope of the app while being open to being replaced with a more secure contextBridge
 * implementation in the future.
 */
export const SleuthAPI = {
  platform: process.platform,
  versions: process.versions,
  sleuthVersion: packageJSON.version,
  getPath: (path: Parameters<typeof app.getPath>[0]) =>
    ipcRenderer.invoke(IpcEvents.GET_PATH, path),
  getUserAgent: (): Promise<string> =>
    ipcRenderer.invoke(IpcEvents.GET_USER_AGENT),
  readLogFile: (
    logFile: UnzippedFile,
    logType: LogType,
  ): Promise<ReadFileResult> =>
    ipcRenderer.invoke(IpcEvents.READ_LOG_FILE, logFile, logType),
  sendWindowReady: () => ipcRenderer.send(IpcEvents.WINDOW_READY),
  sendDoubleClick: () => ipcRenderer.send(IpcEvents.CLICK_TITLEBAR_MAC),
  showOpenDialog: (): Promise<Electron.OpenDialogReturnValue> =>
    ipcRenderer.invoke(IpcEvents.SHOW_OPEN_DIALOG),
  showSaveDialog: (filename: string): Promise<Electron.SaveDialogReturnValue> =>
    ipcRenderer.invoke(IpcEvents.SHOW_SAVE_DIALOG, filename),
  showMessageBox: (
    options: Electron.MessageBoxOptions,
  ): Promise<Electron.MessageBoxReturnValue> =>
    ipcRenderer.invoke(IpcEvents.MESSAGE_BOX, options),
  changeIcon: (iconName: ICON_NAMES) =>
    ipcRenderer.invoke(IpcEvents.CHANGE_ICON, iconName),
  showLogLineContextMenu: (type: LogType): Promise<LogLineContextMenuActions> =>
    ipcRenderer.invoke(IpcEvents.OPEN_LOG_CONTEXT_MENU, type),
  setSetting: (key: string, value: unknown) =>
    ipcRenderer.invoke(IpcEvents.SET_SETTINGS, key, value),
  focusFindOn: (cb: () => void) => ipcRenderer.on(IpcEvents.FIND, cb),
  focusFindOff: (cb: () => void) => ipcRenderer.off(IpcEvents.FIND, cb),
  readStateFile: (file: UnzippedFile) =>
    ipcRenderer.invoke(IpcEvents.READ_STATE_FILE, file),
  logFileUpdate: (options: TouchBarLogFileUpdate) =>
    ipcRenderer.send(IpcEvents.LOG_FILE_UPDATE, options),
  levelFilterUpdate: (options: LevelFilter) =>
    ipcRenderer.send(IpcEvents.LEVEL_FILTER_UPDATE, options),
  setupDarkModeUpdate: (cb: (prefersDarkColors: boolean) => void) =>
    ipcRenderer.on(IpcEvents.DARK_MODE_UPDATE, (_, prefersDarkColors) => {
      cb(prefersDarkColors);
    }),
  setupToggleSidebar: (cb: () => void) =>
    ipcRenderer.on(IpcEvents.TOGGLE_SIDEBAR, cb),
  setColorTheme: (colorTheme: ColorTheme) =>
    ipcRenderer.invoke(IpcEvents.SET_COLOR_THEME, colorTheme),
  /**
   * @deprecated
   */
  readAnyFile: (file: UnzippedFile) =>
    ipcRenderer.invoke(IpcEvents.READ_ANY_FILE, file),
  setupOpenBookmarks: (
    cb: (event: Electron.IpcRendererEvent, data: string) => void,
  ) => ipcRenderer.on(IpcEvents.OPEN_BOOKMARKS, cb),
  setupReset: (cb: () => void) => ipcRenderer.on(IpcEvents.RESET, cb),
  setupToggleFilter: (
    cb: (event: Electron.IpcRendererEvent, level: LogLevel) => void,
  ) => ipcRenderer.on(IpcEvents.TOGGLE_FILTER, cb),
  getSuggestions: () => ipcRenderer.invoke(IpcEvents.GET_SUGGESTIONS),
  setupSuggestionsUpdated: (
    cb: (
      event: Electron.IpcRendererEvent,
      suggestions: Suggestion[],
    ) => Promise<void>,
  ) => {
    ipcRenderer.on(IpcEvents.SUGGESTIONS_UPDATED, cb);
    return () => ipcRenderer.off(IpcEvents.SUGGESTIONS_UPDATED, cb);
  },
  deleteSuggestion: (filePath: string) =>
    ipcRenderer.invoke(IpcEvents.DELETE_SUGGESTION, filePath),
  deleteSuggestions: (filePaths: string[]) =>
    ipcRenderer.invoke(IpcEvents.DELETE_SUGGESTIONS, filePaths),
  setupPreferencesShow: (cb: () => void) => {
    ipcRenderer.on(IpcEvents.PREFERENCES_SHOW, cb);
    return () => ipcRenderer.off(IpcEvents.PREFERENCES_SHOW, cb);
  },
  setupFileDrop: (
    cb: (event: Electron.IpcRendererEvent, url: string) => void,
  ) => {
    ipcRenderer.on(IpcEvents.FILE_DROPPED, cb);
    return () => ipcRenderer.off(IpcEvents.FILE_DROPPED, cb);
  },
  setupOpenSentry: (
    cb: (event: Electron.IpcRendererEvent, filePath: string) => void,
  ) => {
    ipcRenderer.on(IpcEvents.OPEN_SENTRY, cb);
    return () => ipcRenderer.off(IpcEvents.OPEN_SENTRY, cb);
  },
  quit: () => ipcRenderer.invoke(IpcEvents.QUIT),
  cachetoolGetHeaders: (cachePath: string, selectedCacheKey: string) =>
    ipcRenderer.invoke(
      IpcEvents.CACHETOOL_GET_HEADERS,
      cachePath,
      selectedCacheKey,
    ),
  cachetoolGetData: (cachePath: string, selectedCacheKey: string) =>
    ipcRenderer.invoke(
      IpcEvents.CACHETOOL_GET_DATA,
      cachePath,
      selectedCacheKey,
    ),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  openFile: (url: string) => ipcRenderer.invoke(IpcEvents.OPEN_FILE, url),
  cachetoolDownload: (dataPath: string) =>
    ipcRenderer.invoke(IpcEvents.CACHETOOL_DOWNLOAD, dataPath),
  openExternal: (url: string) => shell.openExternal(url),
  clipboard: {
    writeText: (text: string) => clipboard.writeText(text),
  },
  openLineInSource: (
    line: number,
    sourceFile: string,
    options: {
      defaultEditor: string;
    },
  ) =>
    ipcRenderer.invoke(
      IpcEvents.OPEN_LINE_IN_SOURCE,
      line,
      sourceFile,
      options,
    ),
};

contextBridge.exposeInMainWorld('Sleuth', SleuthAPI);
