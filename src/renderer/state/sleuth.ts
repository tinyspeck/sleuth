import { observable, action, autorun, computed, toJS } from 'mobx';
import { ipcRenderer } from 'electron';

import { getItemsInSuggestionFolders } from '../suggestions';
import { testDateTimeFormat } from '../../utils/test-date-time';
import { SORT_DIRECTION } from '../components/log-table-constants';
import { setSetting } from '../settings';
import { isProcessedLogFile } from '../../utils/is-logfile';
import { getFileName } from '../../utils/get-file-name';

import {
  LevelFilter,
  LogEntry,
  MergedLogFile,
  ProcessedLogFile,
  DateRange,
  Suggestions,
  Tool,
  Bookmark,
  MergedLogFiles,
  UnzippedFile,
  SelectableLogFile,
  ProcessedLogFiles,
  SerializedBookmark,
  TimeBucketedLogMetrics
} from '../../interfaces';
import { getInitialTimeViewRange, getTimeBuckedLogMetrics } from './time-view';
import { rehydrateBookmarks, importBookmarks } from './bookmarks';
import { copy } from './copy';
import { changeIcon } from '../ipc';
import { ICON_NAMES, STATE_IPC } from '../../shared-constants';
import { setupTouchBarAutoruns } from './touchbar';
import { TraceProcessor, RendererDescription } from '../processor/trace';

interface SourcemapState {
  progress: number;
  completed: boolean;
  error?: string;
}

const debug = require('debug')('sleuth:state');
export const defaults = {
  dateTimeFormat: 'HH:mm:ss (dd/MM)',
  defaultEditor: 'code --goto {filepath}:{line}',
  font: process.platform === 'darwin' ? 'San Francisco' : 'Segoe UI',
  isDarkMode: true,
  isOpenMostRecent: false,
  isSmartCopy: true
};

export class SleuthState {
  // ** Pantry source map fetching **
  @observable public isUberProxySignedIn = false;
  @observable public uberProxyCookie: string;

  // ** Log file selection **
  // The selected log entry (single log message plus meta data)
  @observable public selectedEntry?: LogEntry;
  @observable public selectedIndex?: number;
  // If not undefined, the user selected a range. If defined,
  // it's the previous selected index
  @observable public selectedRangeIndex?: number;
  // All the entries in the range. Let's hope this isn't horribly slow.
  // We should only over change the whole array.
  @observable.ref public selectedRangeEntries?: Array<LogEntry>;
  // The custom range of the log time view
  @observable public customTimeViewRange: number | undefined;
  // Path to the source directory (zip file, folder path, etc)
  @observable public source?: string;
  // A reference to the selected log file
  @observable.ref public selectedLogFile?: SelectableLogFile;

  //** Cachetool **
  // When looking at the cache using cachetool, we'll keep the selected
  // cache key in this property
  @observable public selectedCacheKey?: string;
  @observable public cachePath?: string;
  @observable public cacheKeys: Array<string> = [];
  @observable public isLoadingCacheKeys?: boolean;

  // ** Search and Filter **
  @observable public levelFilter: LevelFilter = {
    debug: false,
    error: false,
    info: false,
    warn: false
  };
  @observable public searchIndex: number = 0;
  @observable public search: string = '';
  @observable public showOnlySearchResults: boolean | undefined;

  // ** Various "what are we showing" properties **
  @observable public suggestions: Suggestions = [];
  @observable public webAppLogsWarningDismissed: boolean = false;
  @observable public opened: number = 0;
  @observable public dateRange: DateRange = { from: null, to: null };
  @observable public isDetailsVisible: boolean = false;
  @observable public isSidebarOpen: boolean = true;
  @observable public isSpotlightOpen: boolean = false;
  @observable.shallow public bookmarks: Array<Bookmark> = [];
  @observable public serializedBookmarks: Record<string, Array<SerializedBookmark>>
    = this.retrieve('serializedBookmarks', true) as Record<string, Array<SerializedBookmark>> || {};
  // ** Profiler **
  @observable public rendererThreads: Array<RendererDescription> | undefined;
  @observable public sourcemapState: SourcemapState = {progress: 0, completed: false};

  // ** Settings **
  @observable public isDarkMode: boolean = !!this.retrieve('isDarkMode', true);
  @observable public isOpenMostRecent: boolean = !!this.retrieve<boolean>('isOpenMostRecent', true);
  @observable public dateTimeFormat: string
    = testDateTimeFormat(this.retrieve<string>('dateTimeFormat_v3', false)!, defaults.dateTimeFormat);
  @observable public font: string = this.retrieve<string>('font', false)!;
  @observable public defaultEditor: string = this.retrieve<string>('defaultEditor', false)!;
  @observable public defaultSort: SORT_DIRECTION = this.retrieve('defaultSort', false) as SORT_DIRECTION || SORT_DIRECTION.DESC;
  @observable public isMarkIcon: boolean = !!this.retrieve('isMarkIcon', true);
  @observable public isSmartCopy: boolean = !!this.retrieve('isSmartCopy', true);

  // ** Giant non-observable arrays **
  public mergedLogFiles?: MergedLogFiles;
  public processedLogFiles?: ProcessedLogFiles;

  // ** Internal settings **
  private didOpenMostRecent = false;
  private traceProcessor = new TraceProcessor();

  constructor(
    public readonly openFile: (file: string) => void,
    public readonly resetApp: () => void
  ) {
    this.getSuggestions();

    // Setup autoruns
    autorun(() => this.save('dateTimeFormat_v3', this.dateTimeFormat));
    autorun(() => this.save('font', this.font));
    autorun(() => this.save('isOpenMostRecent', this.isOpenMostRecent));
    autorun(() => this.save('isSmartCopy', this.isSmartCopy));
    autorun(() => this.save('defaultEditor', this.defaultEditor));
    autorun(() => this.save('defaultSort', this.defaultSort));
    autorun(() => this.save('serializedBookmarks', this.serializedBookmarks));
    autorun(() => {
      this.save('isDarkMode', this.isDarkMode);

      if (this.isDarkMode) {
        document.body.classList.add('bp3-dark');
      } else {
        document.body.classList.remove('bp3-dark');
      }
    });
    autorun(() => {
      if (this.isSidebarOpen) {
        document.body.classList.add('SidebarOpen');
      } else {
        document.body.classList.remove('SidebarOpen');
      }
    });
    autorun(() => {
      this.save('isMarkIcon', this.isMarkIcon);
      changeIcon(this.isMarkIcon ? ICON_NAMES.mark : ICON_NAMES.default);
    });
    autorun(async () => {
      if (process.platform === 'darwin') {
        this.isLoadingCacheKeys = true;
        if (!this.cachePath) return;

        const { listKeys } = await import('cachetool');
        const keys = await listKeys({ cachePath: this.cachePath });

        // Last entry is sometimes empty
        if (keys.length > 0 && !keys[keys.length - 1]) {
          keys.splice(keys.length - 1, 1);
        }

        this.cacheKeys = keys;
        this.isLoadingCacheKeys = false;
      }
    });

    this.traceProcessor.on('auth-changed', (cookie, isSignedIn) => {
      this.uberProxyCookie = cookie;
      this.isUberProxySignedIn = isSignedIn;
    });
    this.traceProcessor.on('progress', (progress) => {
      this.sourcemapState = { progress, completed: false };
    });
    this.traceProcessor.on('error', (error) => {
      this.sourcemapState = { progress: 1, completed: true, error};
    });
    this.traceProcessor.on('completed', () => {
      this.sourcemapState = { progress: 1, completed: true};
    });

    autorun(() => this.traceProcessor.setCookie(this.uberProxyCookie));

    this.reset = this.reset.bind(this);
    this.toggleDarkMode = this.toggleDarkMode.bind(this);
    this.toggleSidebar = this.toggleSidebar.bind(this);
    this.toggleSpotlight = this.toggleSpotlight.bind(this);
    this.selectLogFile = this.selectLogFile.bind(this);
    this.setMergedFile = this.setMergedFile.bind(this);
    this.onFilterToggle = this.onFilterToggle.bind(this);

    setupTouchBarAutoruns(this);
    ipcRenderer.on(STATE_IPC.TOGGLE_SIDEBAR, this.toggleSidebar);
    ipcRenderer.on(STATE_IPC.TOGGLE_SPOTLIGHT, this.toggleSpotlight);
    ipcRenderer.on(STATE_IPC.OPEN_BOOKMARKS, (_event, data) => importBookmarks(this, data));
    ipcRenderer.on(STATE_IPC.COPY, () => copy(this));
    ipcRenderer.on(STATE_IPC.RESET, () => this.reset(true));
    ipcRenderer.on(STATE_IPC.TOGGLE_DARKMODE, () => this.toggleDarkMode());
    ipcRenderer.on(STATE_IPC.TOGGLE_FILTER, (_event, level: string) => {
      this.onFilterToggle(level);
    });

    document.oncopy = (event) => {
      if (copy(this)) {
        event.preventDefault();
      }
    };

    // Debug
    if (window) {
      (window as any).sleuthState = this;
    }
  }

  @computed get isLogViewVisible() {
    return !this.isDetailsVisible;
  }

  /**
   * Return the file name of the currently selected file.
   *
   * @returns {string}
   */
  @computed
  public get selectedFileName(): string {
    return this.selectedLogFile
      ? getFileName(this.selectedLogFile)
      : '';
  }

  @computed
  public get initialTimeViewRange(): number {
    return this.selectedLogFile ? getInitialTimeViewRange(this.selectedLogFile) : 0;
  }

  @computed
  public get timeBucketedLogMetrics(): TimeBucketedLogMetrics {
    const range = this.customTimeViewRange || this.initialTimeViewRange;
    return this.selectedLogFile
      ? getTimeBuckedLogMetrics(this.selectedLogFile, range)
      : {};
  }

  @action
  public setSource(source: string) {
    this.source = source;
  }

  @action
  public toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
  }

  @action
  public toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  @action
  public toggleSpotlight() {
    this.isSpotlightOpen = !this.isSpotlightOpen;
  }

  @action
  public async getSuggestions() {
    this.suggestions = await getItemsInSuggestionFolders();

    // This is a side effect. There's probably a better
    // place for it, since we only want to run it once,
    // but here we are.
    this.openMostRecentSuggestionMaybe();
  }

  @action
  public openMostRecentSuggestionMaybe() {
    if (!this.isOpenMostRecent || this.didOpenMostRecent) return;
    if (this.suggestions.length === 0) return;

    let mostRecentStats = this.suggestions[0];

    for (const stats of this.suggestions) {
      if (stats.mtimeMs > mostRecentStats.mtimeMs) {
        mostRecentStats = stats;
      }
    }

    this.didOpenMostRecent = true;
    this.openFile(mostRecentStats.filePath);
  }

  @action
  public reset(goBackToHome: boolean = false) {
    this.processedLogFiles = undefined;
    this.mergedLogFiles = undefined;
    this.selectedEntry = undefined;
    this.selectedIndex = undefined;
    this.selectedLogFile = undefined;
    this.bookmarks = [];
    this.levelFilter.debug = false;
    this.levelFilter.error = false;
    this.levelFilter.info = false;
    this.levelFilter.warn = false;
    this.searchIndex = 0;
    this.showOnlySearchResults = undefined;
    this.isSpotlightOpen = false;
    this.isDetailsVisible = false;
    this.dateRange = { from: null, to: null };
    this.cacheKeys = [];
    this.cachePath = undefined;
    this.selectedCacheKey = undefined;
    this.isLoadingCacheKeys = false;
    this.sourcemapState = {progress: 0, completed: false};
    this.rendererThreads = undefined;
    this.traceProcessor.reset();

    if (goBackToHome) {
      this.resetApp();
    }
  }

  /**
   * Select a log file. This is a more complex operation than one might think -
   * mostly because we might need to create a merged file on-the-fly.
   *
   * @param {ProcessedLogFile} logFile
   * @param {string} [logType]
   */
  @action
  public selectLogFile(logFile: ProcessedLogFile | UnzippedFile | null, logType?: string): void {
    this.selectedEntry = undefined;
    this.selectedRangeEntries = undefined;
    this.selectedRangeIndex = undefined;
    this.selectedIndex = undefined;
    this.customTimeViewRange = undefined;

    if (!logFile && logType) {
      debug(`Selecting log type ${logType}`);

      // If our "logtype" is actually a tool (like Cache), we'll set it
      if (logType in Tool) {
        this.selectedLogFile = logType as Tool;
      } else if (this.mergedLogFiles && this.mergedLogFiles[logType]) {
        this.selectedLogFile = this.mergedLogFiles[logType];
      }
    } else if (logFile) {
      const name = isProcessedLogFile(logFile) ? logFile.logType : logFile.fileName;
      debug(`Selecting log file ${name}`);

      this.selectedLogFile = logFile;
    }
  }

  /**
   * Handle the click of a single "filter toggle" button
   *
   * @param {string} level
   * @memberof SleuthState
   */
  @action
  public onFilterToggle(level: string) {
    if (this.levelFilter![level] !== undefined) {
      const filter = {...this.levelFilter};
      filter[level] = !filter[level];

      this.levelFilter = filter;
    }
  }

  @action
  public async getRendererProcesses(file: UnzippedFile) {
    try {
      this.rendererThreads = await this.traceProcessor.getRendererProcesses(file);
    } catch (e) {
      debug('Unable to get renderer processes', e);
    }
  }

  @action
  public async sourcemap(file: UnzippedFile) {
    try {
      await this.traceProcessor.sourcemap(this, file);
    } catch (e) {
      debug('Unable to get sorucemap file', e);
    }
  }

  @action
  public async rawRenderer(file: UnzippedFile, pid: number) {
    return this.traceProcessor.rawRenderer(file, pid);
  }

  @action
  public async processRenderer(file: UnzippedFile, pid: number) {
    return this.traceProcessor.processRenderer(this, file, pid);
  }

  /**
   * Update this component's status with a merged logfile
   *
   * @param {MergedLogFile} mergedFile
   */
  public setMergedFile(mergedFile: MergedLogFile) {
    const newMergedLogFiles = { ...this.mergedLogFiles as MergedLogFiles };

    debug(`Merged log file for ${mergedFile.logType} now created!`);
    newMergedLogFiles[mergedFile.logType] = mergedFile;
    this.mergedLogFiles = newMergedLogFiles;

    // Recalculate bookmarks
    rehydrateBookmarks(this);
  }

  /**
   * Save a key/value to localStorage.
   *
   * @param {string} key
   * @param {(string | number | object)} [value]
   */
  private save(key: string, value?: string | number | object | null | boolean) {
    if (value !== undefined) {
      const _value = typeof value === 'object'
        ? JSON.stringify(value)
        : value.toString();

      localStorage.setItem(key, _value);
    } else {
      localStorage.removeItem(key);
    }

    setSetting(key, toJS(value));
  }

  /**
   * Fetch data from localStorage.
   *
   * @template T
   * @param {string} key
   * @param {boolean} parse
   * @returns {(T | string | null)}
   */
  private retrieve<T>(
    key: string, parse: boolean
  ): T | string | null {
    let value: T | string | null = localStorage.getItem(key);

    if (parse) {
      value = JSON.parse(value || 'null') as T;
    }

    if (value === null && defaults[key]) {
      return defaults[key];
    }

    return value;
  }
}
