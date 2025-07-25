import { observable, action, autorun, computed, toJS, reaction } from 'mobx';
import debug from 'debug';

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
  Bookmark,
  MergedLogFiles,
  UnzippedFile,
  SelectableLogFile,
  ProcessedLogFiles,
  SerializedBookmark,
  TimeBucketedLogMetrics,
  LogLevel,
  LogType,
  KnownLogType,
  Suggestion,
  SelectableLogType,
} from '../../interfaces';
import {
  getInitialTimeViewRange,
  getTimeBucketedLogMetrics,
} from './time-view';
import { rehydrateBookmarks, importBookmarks } from './bookmarks';
import { copy } from './copy';
import { ICON_NAMES } from '../../shared-constants';
import { setupTouchBarAutoruns } from './touchbar';
import { TraceThreadDescription } from '../processor/trace';
import { ColorTheme } from '../components/preferences/preferences';
import { StateTableState } from '../components/state-table';
import { Editor, EDITORS } from '../components/preferences/preferences-utils';

const d = debug('sleuth:state');

export class SleuthState {
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

  // ** Search and Filter **
  @observable public levelFilter: LevelFilter = {
    debug: false,
    error: false,
    info: false,
    warn: false,
  };
  @observable public searchIndex = 0;
  @observable public searchList: number[] = [];
  @observable public search = '';
  @observable public showOnlySearchResults: boolean | undefined;

  // ** Various "what are we showing" properties **
  @observable public suggestions: Suggestion[] = [];
  @observable public suggestionsLoaded = false;
  @observable public webAppLogsWarningDismissed = false;
  @observable public opened = 0;
  @observable public dateRange: DateRange = { from: null, to: null };
  @observable public isDetailsVisible = false;
  @observable public isSidebarOpen = true;
  @observable public isSpotlightOpen = false;
  @observable.shallow public bookmarks: Array<Bookmark> = [];
  @observable public serializedBookmarks: Record<
    string,
    Array<SerializedBookmark>
  > = this.retrieve<Record<string, Array<SerializedBookmark>>>(
    'serializedBookmarks',
    { parse: true, fallback: {} },
  );
  @observable public prefersDarkColors = false;
  // ** Profiler **
  @observable public traceThreads?: Array<TraceThreadDescription>;

  // ** Settings **
  @observable public colorTheme = this.retrieve<ColorTheme>('colorTheme', {
    parse: false,
    fallback: ColorTheme.System,
  });
  @observable public isOpenMostRecent = !!this.retrieve<boolean>(
    'isOpenMostRecent',
    { parse: true, fallback: false },
  );
  @observable public dateTimeFormat_v3: string = testDateTimeFormat(
    this.retrieve<string>('dateTimeFormat_v3', {
      parse: false,
      fallback: 'HH:mm:ss (dd/MM)',
    }),
    'HH:mm:ss (dd/MM)',
  );
  @observable public font: string = this.retrieve<string>('font', {
    parse: false,
    fallback:
      window.Sleuth.platform === 'darwin' ? 'San Francisco' : 'Segoe UI',
  });
  @observable public defaultEditor: Editor = this.retrieve<Editor>(
    'defaultEditor',
    { parse: true, fallback: EDITORS[0] },
  );
  @observable public defaultSort: SORT_DIRECTION =
    this.retrieve<SORT_DIRECTION>('defaultSort', {
      parse: false,
      fallback: SORT_DIRECTION.DESC,
    });
  @observable public isMarkIcon = !!this.retrieve<boolean>('isMarkIcon', {
    parse: true,
  });
  @observable public isSmartCopy = !!this.retrieve<boolean>('isSmartCopy', {
    parse: true,
  });

  // ** Giant non-observable arrays **
  public mergedLogFiles?: MergedLogFiles;
  public processedLogFiles?: ProcessedLogFiles;

  public stateFiles: Record<string, StateTableState<any>> = {};

  // ** Internal settings **
  private didOpenMostRecent = false;

  constructor(
    public readonly openFile: (file: string) => void,
    public readonly resetApp: () => void,
  ) {
    this.getSuggestions();
    window.Sleuth.setupDarkModeUpdate((prefersDarkColors) => {
      this.prefersDarkColors = prefersDarkColors;
    });

    // Setup autoruns
    autorun(() => this.save('dateTimeFormat_v3', this.dateTimeFormat_v3));
    autorun(() => this.save('font', this.font));
    autorun(() => this.save('isOpenMostRecent', this.isOpenMostRecent));
    autorun(() => this.save('isSmartCopy', this.isSmartCopy));
    autorun(() => this.save('defaultEditor', this.defaultEditor));
    autorun(() => this.save('defaultSort', this.defaultSort));
    autorun(() => this.save('serializedBookmarks', this.serializedBookmarks));
    autorun(async () => {
      this.save('colorTheme', this.colorTheme);
      const prefersDarkColors = await window.Sleuth.setColorTheme(
        this.colorTheme,
      );
      this.prefersDarkColors = prefersDarkColors;
    });
    autorun(async () => {
      // handles BlueprintJS color theming
      // antd theming is handled by querying `this.prefersDarkColors` within app.tsx
      if (this.prefersDarkColors) {
        document.body.classList.add('bp4-dark');
      } else {
        document.body.classList.remove('bp4-dark');
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
      window.Sleuth.changeIcon(
        this.isMarkIcon ? ICON_NAMES.mark : ICON_NAMES.default,
      );
    });

    autorun(() => {
      if (!this.selectedEntry && !this.selectedIndex) {
        this.isDetailsVisible = false;
      }
    });

    this.reset = this.reset.bind(this);
    this.toggleSidebar = this.toggleSidebar.bind(this);
    this.toggleSpotlight = this.toggleSpotlight.bind(this);
    this.selectLogFile = this.selectLogFile.bind(this);
    this.setMergedFile = this.setMergedFile.bind(this);
    this.setFilterLogLevels = this.setFilterLogLevels.bind(this);

    setupTouchBarAutoruns(this);
    window.Sleuth.setupToggleSidebar(this.toggleSidebar);
    window.Sleuth.setupToggleSpotlight(this.toggleSpotlight);
    window.Sleuth.setupOpenBookmarks((_event, data) =>
      importBookmarks(this, data),
    );
    window.Sleuth.setupReset(() => this.reset(true));
    window.Sleuth.setupToggleFilter((_event, level: LogLevel) => {
      this.setFilterLogLevels({ [level]: !this.levelFilter[level] });
    });

    document.oncopy = (event) => {
      if (copy(this)) {
        event.preventDefault();
      }
    };
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
    return this.selectedLogFile ? getFileName(this.selectedLogFile) : '';
  }

  @computed
  public get initialTimeViewRange(): number {
    return this.selectedLogFile
      ? getInitialTimeViewRange(this.selectedLogFile)
      : 0;
  }

  @computed
  public get timeBucketedLogMetrics(): TimeBucketedLogMetrics {
    const range = this.customTimeViewRange || this.initialTimeViewRange;
    return this.selectedLogFile
      ? getTimeBucketedLogMetrics(this.selectedLogFile, range)
      : {};
  }

  @action
  public setSource(source: string) {
    this.source = source;
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
  public async getSuggestions(suggestions?: Suggestion[]) {
    this.suggestions = suggestions || (await window.Sleuth.getSuggestions());
    this.suggestionsLoaded = true;

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
  public reset(goBackToHome = false) {
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
    this.traceThreads = undefined;

    if (goBackToHome) {
      this.resetApp();
    }
  }

  /**
   * Select a log file. This is a more complex operation than one might think -
   * mostly because we might need to create a merged file on-the-fly.
   */
  @action
  public selectLogFile(
    logFile: ProcessedLogFile | UnzippedFile | null,
    logType?: SelectableLogType,
  ): void {
    this.selectedEntry = undefined;
    this.selectedRangeEntries = undefined;
    this.selectedRangeIndex = undefined;
    this.selectedIndex = undefined;
    this.customTimeViewRange = undefined;

    if (logFile) {
      const name = isProcessedLogFile(logFile)
        ? logFile.logType
        : logFile.fileName;
      d(`Selecting log file ${name}`);

      this.selectedLogFile = logFile;
    } else if (
      logType &&
      Object.values(LogType).includes(logType as LogType) &&
      this.mergedLogFiles
    ) {
      d(`Selecting log type ${logType}`);
      this.selectedLogFile = this.mergedLogFiles[logType as KnownLogType];
    }
  }

  /**
   * Handle the click of a single "filter toggle" button
   */
  @action
  public setFilterLogLevels(levels: Partial<LevelFilter>) {
    this.levelFilter = { ...this.levelFilter, ...levels };
  }

  /**
   * Update this component's status with a merged logfile
   *
   * @param {MergedLogFile} mergedFile
   */
  public setMergedFile(mergedFile: MergedLogFile) {
    const newMergedLogFiles = { ...(this.mergedLogFiles as MergedLogFiles) };

    d(`Merged log file for ${mergedFile.logType} now created!`);
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
      const _value =
        typeof value === 'object' ? JSON.stringify(value) : value.toString();

      localStorage.setItem(key, _value);
    } else {
      localStorage.removeItem(key);
    }

    setSetting(key, toJS(value));
  }

  /**
   * Fetch data from localStorage.
   */
  private retrieve<T>(
    key: keyof SleuthState,
    options: { parse: boolean; fallback: T },
  ): T;
  private retrieve<T>(key: keyof SleuthState, options: { parse: boolean }): T;
  private retrieve(key: keyof SleuthState, options: never): string | null;
  private retrieve<T>(
    key: keyof SleuthState,
    options: Partial<{
      parse: boolean;
      fallback: T;
    }>,
  ): T | string | null {
    const localStorageValue: string | null = localStorage.getItem(key);

    if (options?.parse) {
      let parsed: T | null;
      try {
        parsed = JSON.parse(localStorageValue || 'null') as T | null;
      } catch {
        return options.fallback ?? null;
      }

      if (parsed === null && options.fallback !== undefined) {
        return options.fallback;
      } else {
        return parsed;
      }
    }

    if (localStorageValue === null && options?.fallback !== undefined) {
      return options.fallback;
    }

    return localStorageValue;
  }
}
