import path from 'node:path';

import fs from 'node:fs';
import { IpcEvents } from '../ipc-events';
import { ICON_NAMES } from '../shared-constants';
import {
  LiveTailUpdatePayload,
  LogLineContextMenuActions,
  LogType,
  Suggestion,
  UnzippedFile,
  UnzippedFiles,
} from '../interfaces';
import { ReadFileResult } from '../main/filesystem/read-file';
import { ColorTheme } from '../renderer/components/preferences/preferences';
import {
  clipboard,
  shell,
  ipcRenderer,
  webUtils,
  contextBridge,
  app,
} from 'electron';
import { Editor } from '../renderer/components/preferences/preferences-utils';

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
    userTZ?: string,
  ): Promise<ReadFileResult> =>
    ipcRenderer.invoke(IpcEvents.READ_LOG_FILE, logFile, logType, userTZ),
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
  showLogLineContextMenu: (): Promise<LogLineContextMenuActions> =>
    ipcRenderer.invoke(IpcEvents.OPEN_LOG_CONTEXT_MENU),
  setSetting: (key: string, value: unknown) =>
    ipcRenderer.invoke(IpcEvents.SET_SETTINGS, key, value),
  focusFind: (cb: () => void) => {
    ipcRenderer.on(IpcEvents.FIND, cb);
    return () => ipcRenderer.off(IpcEvents.FIND, cb);
  },
  readStateFile: (file: UnzippedFile) =>
    ipcRenderer.invoke(IpcEvents.READ_STATE_FILE, file),
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
  isTraceSourcemapped: (file: UnzippedFile) =>
    ipcRenderer.invoke(IpcEvents.TRACE_CHECK_SOURCEMAP, file),
  setupOpenBookmarks: (
    cb: (event: Electron.IpcRendererEvent, data: string) => void,
  ) => ipcRenderer.on(IpcEvents.OPEN_BOOKMARKS, cb),
  setupReset: (cb: () => void) => ipcRenderer.on(IpcEvents.RESET, cb),
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
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  openFile: (url: string) => ipcRenderer.invoke(IpcEvents.OPEN_FILE, url),
  openExternal: (url: string) => shell.openExternal(url),
  clipboard: {
    writeText: (text: string) => clipboard.writeText(text),
  },
  openLineInSource: (
    line: number,
    sourceFile: string,
    options: {
      defaultEditor: Editor;
    },
  ) =>
    ipcRenderer.invoke(
      IpcEvents.OPEN_LINE_IN_SOURCE,
      line,
      sourceFile,
      options,
    ),
  startLiveTail: (logsPath: string, userTZ?: string): Promise<UnzippedFiles> =>
    ipcRenderer.invoke(IpcEvents.LIVE_TAIL_START, logsPath, userTZ),
  stopLiveTail: (): Promise<void> =>
    ipcRenderer.invoke(IpcEvents.LIVE_TAIL_STOP),
  setupLiveTailUpdate: (
    cb: (
      event: Electron.IpcRendererEvent,
      payload: LiveTailUpdatePayload,
    ) => void,
  ) => {
    ipcRenderer.on(IpcEvents.LIVE_TAIL_UPDATE, cb);
    return () => ipcRenderer.off(IpcEvents.LIVE_TAIL_UPDATE, cb);
  },
  setupLiveTailDropped: (
    cb: (event: Electron.IpcRendererEvent, logsPath: string) => void,
  ) => {
    ipcRenderer.on(IpcEvents.LIVE_TAIL_DROPPED, cb);
    return () => ipcRenderer.off(IpcEvents.LIVE_TAIL_DROPPED, cb);
  },
};

contextBridge.exposeInMainWorld('Sleuth', SleuthAPI);
