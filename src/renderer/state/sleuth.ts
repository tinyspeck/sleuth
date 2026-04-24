import {
  observable,
  action,
  autorun,
  computed,
  toJS,
  makeObservable,
  runInAction,
} from 'mobx';
import debug from 'debug';

import { testDateTimeFormat } from '../../utils/test-date-time';
import { SortDirection, SortDirectionType } from 'react-virtualized';
import { setSetting } from '../settings';
import { isLogFile } from '../../utils/is-logfile';
import { getFileName } from '../../utils/get-file-name';

import {
  LevelFilter,
  LogEntry,
  LogTypeFilter,
  MergedLogFile,
  DateRange,
  Bookmark,
  MergedLogFiles,
  SelectableLogFile,
  ProcessedLogFiles,
  SerializedBookmark,
  TimeBucketedLogMetrics,
  LogType,
  Suggestion,
  TRACE_VIEWER,
  LOG_TYPES_TO_PROCESS,
} from '../../interfaces';
import {
  getInitialTimeViewRange,
  getTimeBucketedLogMetrics,
} from './time-view';
import { rehydrateBookmarks, importBookmarks } from './bookmarks';
import { copy } from './copy';
import { ICON_NAMES } from '../../shared-constants';
import { TraceThreadDescription } from '../processor/trace';
import { ColorTheme } from '../components/preferences/preferences';
import { StateTableState } from '../components/state-table';
import { Editor, EDITORS } from '../components/preferences/preferences-utils';

const d = debug('sleuth:state');

const DEFAULT_LOG_TYPE_FILTER: LogTypeFilter = Object.fromEntries(
  LOG_TYPES_TO_PROCESS.map((t) => [t, true]),
) as LogTypeFilter;

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
  @observable.ref public selectedFile?: SelectableLogFile;

  // ** Search and Filter **
  @observable public levelFilter: LevelFilter = {
    debug: true,
    error: true,
    info: true,
    warn: true,
  };
  @observable public logTypeFilter: LogTypeFilter = {
    ...DEFAULT_LOG_TYPE_FILTER,
  };
  @observable public selectedTags: string[] = [];
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
  @observable public showStateSummary = false;
  @observable public isUserTZ = false;
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
  @observable public selectedTracePid?: number;

  @observable
  public selectedTraceViewer: TRACE_VIEWER | undefined;

  // ** Settings **
  @observable public colorTheme = this.retrieve<ColorTheme>('colorTheme', {
    parse: false,
    fallback: ColorTheme.System,
  });
  @observable public isOpenMostRecent = !!this.retrieve<boolean>(
    'isOpenMostRecent',
    { parse: true, fallback: false },
  );
  @observable public dateTimeFormat_v4: string = testDateTimeFormat(
    this.retrieve<string>('dateTimeFormat_v4', {
      parse: false,
      fallback: 'yyyy-MM-dd HH:mm:ss',
    }),
    'yyyy-MM-dd HH:mm:ss',
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
  @observable public defaultSort: SortDirectionType =
    this.retrieve<SortDirectionType>('defaultSort', {
      parse: false,
      fallback: SortDirection.DESC,
    });
  @observable public isMarkIcon = !!this.retrieve<boolean>('isMarkIcon', {
    parse: true,
  });
  @observable public isSmartCopy = !!this.retrieve<boolean>('isSmartCopy', {
    parse: true,
  });

  // ** Live Tail **
  @observable public isLiveTailActive = false;
  @observable public isAutoScrollEnabled = true;
  @observable public liveTailRevision = 0;
  public liveTailTagCounts = new Map<string, number>();

  // ** Giant non-observable arrays **
  public mergedLogFiles?: MergedLogFiles;
  public processedLogFiles?: ProcessedLogFiles;

  public stateFiles: Record<string, StateTableState> = {};

  // ** Internal settings **
  private didOpenMostRecent = false;

  constructor(
    public readonly openFile: (file: string) => void,
    public readonly resetApp: () => void,
  ) {
    makeObservable(this);

    this.getSuggestions();
    window.Sleuth.setupDarkModeUpdate((prefersDarkColors) => {
      this.prefersDarkColors = prefersDarkColors;
    });

    // Setup autoruns
    autorun(() => this.save('dateTimeFormat_v4', this.dateTimeFormat_v4));
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
    this.selectFile = this.selectFile.bind(this);
    this.setMergedFile = this.setMergedFile.bind(this);
    this.setFilterLogLevels = this.setFilterLogLevels.bind(this);

    window.Sleuth.setupToggleSidebar(this.toggleSidebar);
    window.Sleuth.setupOpenBookmarks((_event, data) =>
      importBookmarks(this, data),
    );
    window.Sleuth.setupReset(() => this.reset(true));
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
    return this.selectedFile ? getFileName(this.selectedFile) : '';
  }

  @computed
  public get initialTimeViewRange(): number {
    return this.selectedFile ? getInitialTimeViewRange(this.selectedFile) : 0;
  }

  @computed
  public get timeBucketedLogMetrics(): TimeBucketedLogMetrics {
    const range = this.customTimeViewRange || this.initialTimeViewRange;
    return this.selectedFile
      ? getTimeBucketedLogMetrics(this.selectedFile, range)
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
  public toggleTZ() {
    this.isUserTZ = !this.isUserTZ;
  }

  public async getSuggestions(suggestions?: Suggestion[]) {
    const resolved = suggestions || (await window.Sleuth.getSuggestions());
    runInAction(() => {
      this.suggestions = resolved;
      this.suggestionsLoaded = true;
      this.openMostRecentSuggestionMaybe();
    });
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
    if (this.isLiveTailActive) {
      window.Sleuth.stopLiveTail();
      this.isLiveTailActive = false;
      this.isAutoScrollEnabled = true;
      this.liveTailTagCounts.clear();
    }

    this.source = undefined;
    this.processedLogFiles = undefined;
    this.mergedLogFiles = undefined;
    this.selectedEntry = undefined;
    this.selectedIndex = undefined;
    this.selectedFile = undefined;
    this.bookmarks = [];
    this.levelFilter.debug = true;
    this.levelFilter.error = true;
    this.levelFilter.info = true;
    this.levelFilter.warn = true;
    this.logTypeFilter = { ...DEFAULT_LOG_TYPE_FILTER };
    this.selectedTags = [];
    this.searchIndex = 0;
    this.showOnlySearchResults = undefined;
    this.showStateSummary = false;
    this.isDetailsVisible = false;
    this.dateRange = { from: null, to: null };
    this.traceThreads = undefined;
    this.selectedTracePid = undefined;
    this.stateFiles = {};

    if (goBackToHome) {
      this.resetApp();
    }
  }

  @action
  public selectFile(logFile: SelectableLogFile): void {
    this.selectedEntry = undefined;
    this.selectedRangeEntries = undefined;
    this.selectedRangeIndex = undefined;
    this.selectedIndex = undefined;
    this.customTimeViewRange = undefined;
    this.showStateSummary = false;

    const name = isLogFile(logFile) ? logFile.logType : logFile.fileName;
    d(`Selecting log file ${name}`);

    this.selectedFile = logFile;
  }

  @action
  public selectAllLogs(): void {
    const allMerged = this.mergedLogFiles?.[LogType.ALL];
    if (allMerged) {
      this.selectFile(allMerged);
    }
  }

  /**
   * Handle the click of a single "filter toggle" button
   */
  @action
  public setFilterLogLevels(levels: Partial<LevelFilter>) {
    this.levelFilter = { ...this.levelFilter, ...levels };
  }

  @action
  public setLogTypeFilter(types: Partial<LogTypeFilter>) {
    this.logTypeFilter = { ...this.logTypeFilter, ...types };
  }

  @action
  public setSelectedTags(tags: string[]) {
    this.selectedTags = tags;
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

  @action
  public updateLiveTailFile(updatedMerged: MergedLogFile) {
    const newMergedLogFiles = { ...(this.mergedLogFiles as MergedLogFiles) };
    newMergedLogFiles[updatedMerged.logType] = updatedMerged;
    this.mergedLogFiles = newMergedLogFiles;

    const sel = this.selectedFile;
    if (sel && isLogFile(sel) && sel.logType === updatedMerged.logType) {
      this.selectedFile = updatedMerged;
    }

    this.liveTailRevision++;
  }

  @action
  public setLiveTailActive(active: boolean) {
    this.isLiveTailActive = active;
    if (active) {
      this.isAutoScrollEnabled = true;
    }
  }

  @action
  public setAutoScrollEnabled(enabled: boolean) {
    this.isAutoScrollEnabled = enabled;
  }

  /**
   * Open a trace viewer by setting active file and viewer type
   */
  @action
  public openTraceViewer(viewerType: TRACE_VIEWER): void {
    d(`Opening trace viewer: ${viewerType}`);

    this.selectedTraceViewer = viewerType;
    this.selectedTracePid = undefined;

    if (!this.processedLogFiles?.trace?.length) {
      return;
    }

    const firstTraceFile = this.processedLogFiles?.trace[0];
    if (firstTraceFile) {
      this.selectFile(firstTraceFile);
    }
  }

  @action
  public setTraceThreads(threads: TraceThreadDescription[] | undefined) {
    this.traceThreads = threads;
  }

  @action
  public setSelectedTracePid(pid: number | undefined) {
    this.selectedTracePid = pid;
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
