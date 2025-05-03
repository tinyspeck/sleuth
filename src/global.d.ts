import { app } from 'electron/main';
import {
  LevelFilter,
  LogLevel,
  LogLineContextMenuActions,
  Suggestion,
  TouchBarLogFileUpdate,
  UnzippedFile,
} from './interfaces';
import { ICON_NAMES } from './shared-constants';
import { LogType } from './interfaces';
import { ReadFileResult } from './main/filesystem/read-file';
import { StateTableState } from './renderer/components/state-table';
import { ColorTheme } from './renderer/components/preferences';

declare global {
  interface Window {
    Sleuth: {
      platform: 'win32' | 'darwin' | 'linux';
      versions: NodeJS.ProcessVersions;
      sleuthVersion: string;
      getPath: (
        path: Parameters<typeof app.getPath>[0],
      ) => ReturnType<typeof app.getPath>;
      getUserAgent: () => Promise<string>;
      sendWindowReady: () => void;
      sendDoubleClick: () => void;
      showOpenDialog: () => Promise<Electron.OpenDialogReturnValue>;
      showSaveDialog: (
        filename: string,
      ) => Promise<Electron.SaveDialogReturnValue>;
      showMessageBox: (
        options: Electron.MessageBoxOptions,
      ) => Promise<Electron.MessageBoxReturnValue>;
      changeIcon: (iconName: ICON_NAMES) => void;
      showLogLineContextMenu: (
        type: LogType,
      ) => Promise<LogLineContextMenuActions>;
      readLogFile: (
        logFile: UnzippedFile,
        logType: LogType,
      ) => Promise<ReadFileResult>;
      setSetting: (key: string, value: unknown) => Promise<void>;
      focusFindOn: (cb: () => void) => void;
      focusFindOff: (cb: () => void) => void;
      readStateFile: (
        file: UnzippedFile,
      ) => Promise<StateTableState<any> | undefined>;
      logFileUpdate: (options: TouchBarLogFileUpdate) => void;
      levelFilterUpdate: (options: LevelFilter) => void;
      setupDarkModeUpdate: (cb: (prefersDarkColors: boolean) => void) => void;
      setColorTheme: (colorTheme: ColorTheme) => Promise<boolean>;
      readAnyFile: (file: UnzippedFile) => Promise<string>;
      setupToggleSidebar: (cb: () => void) => void;
      setupOpenBookmarks: (
        cb: (event: Electron.IpcRendererEvent, data: string) => void,
      ) => void;
      setupReset: (cb: () => void) => void;
      setupToggleFilter: (
        cb: (event: Electron.IpcRendererEvent, level: LogLevel) => void,
      ) => void;
      getSuggestions: () => Promise<Suggestion[]>;
      setupSuggestionsUpdated: (
        cb: (
          event: Electron.IpcRendererEvent,
          suggestions: Suggestion[],
        ) => void,
      ) => () => void;
      deleteSuggestion: (filePath: string) => Promise<boolean>;
      deleteSuggestions: (filePaths: string[]) => Promise<boolean>;
      setupPreferencesShow: (cb: () => void) => () => void;
      setupFileDrop: (
        cb: (event: Electron.IpcRendererEvent, url: string) => void,
      ) => () => void;
      setupOpenSentry: (
        cb: (event: Electron.IpcRendererEvent, filePath: string) => void,
      ) => () => void;
      quit: () => Promise<void>;
      cachetoolGetHeaders: (
        cachePath: string,
        selectedCacheKey: string,
      ) => Promise<string>;
      cachetoolGetData: (
        cachePath: string,
        selectedCacheKey: string,
      ) => Promise<string>;
      getPathForFile: (file: File) => string;
      openFile: (url: string) => Promise<UnzippedFile[]>;
      cachetoolDownload: (dataPath: string) => Promise<void>;
      openExternal: (url: string) => void;
      clipboard: {
        writeText: (text: string) => void;
      };
    };
  }
}

export {};
