import fs from 'fs-extra';

// Anything that's valid as a "selected" log file.
export type SelectableLogFile = LogFile | UnzippedFile;

export type LogFile = MergedLogFile | ProcessedLogFile;

export type RepeatedCounts = Record<string, number>;

export enum LogType {
  ALL = 'all',
  BROWSER = 'browser',
  RX_EPIC = 'rx_epic',
  WEBAPP = 'webapp',
  SERVICE_WORKER = 'webapp_sw',
  STATE = 'state',
  NETLOG = 'netlog',
  TRACE = 'trace',
  INSTALLER = 'installer',
  MOBILE = 'mobile',
  CHROMIUM = 'chromium',
  UNKNOWN = 'unknown',
}

export type KnownLogType = Exclude<LogType, LogType.UNKNOWN | LogType.ALL>;
export type SelectableLogType = Exclude<LogType, LogType.UNKNOWN>;

export const LOG_TYPES_TO_PROCESS = [
  LogType.BROWSER,
  LogType.RX_EPIC,
  LogType.WEBAPP,
  LogType.SERVICE_WORKER,
  LogType.INSTALLER,
  LogType.MOBILE,
  LogType.CHROMIUM,
] as const;

export type ProcessableLogType = (typeof LOG_TYPES_TO_PROCESS)[number];

export type RawLogType = Exclude<KnownLogType, ProcessableLogType>;

export type ProcessedLogFiles = Record<
  ProcessableLogType,
  Array<ProcessedLogFile>
> &
  Record<RawLogType, Array<UnzippedFile>>;
export type SortedUnzippedFiles = Record<KnownLogType, Array<UnzippedFile>>;

export interface Bookmark {
  logEntry: LogEntry;
  logFile: LogFile;
}

export interface SerializedBookmark {
  logEntry: {
    line: number;
    index: number;
  };
  logFile: {
    id: string;
    type: 'ProcessedLogFile' | 'MergedLogFile';
  };
}

// [ logEntry.line, logEntry.index, logFile.id, logFile.type ]
export type CompressedBookmark = [number, number, string, number];

export interface ProcessorPerformanceInfo {
  name: string;
  type: SelectableLogType;
  lines: number;
  entries: number;
  processingTime: number;
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface LogTag {
  /** The extracted tag name, e.g. `"Store"`, `"HUDDLES"`, `"fooBarEpic"`.
   *  Used for color hashing and display grouping. */
  name: string;
  /** Length of the full prefix match in the original message string,
   *  e.g. `"Store:"` is 6, `"[HUDDLES]"` is 9, `"Tag = fooBarEpic;"` is 18.
   *  Lets the renderer slice the display prefix and remaining message
   *  without re-running the regex. */
  offset: number;
}

export interface LogEntry {
  index: number;
  timestamp: string;
  message: string;
  tag?: LogTag;
  level: LogLevel;
  logType: LogType;
  line: number;
  sourceFile: string;
  meta?: string | LogEntry;
  momentValue?: number;
  repeated?: Array<string>;
}

export interface MatchResult {
  timestamp?: string;
  message?: string;
  level?: string;
  meta?: unknown;
  toParseHead?: string;
  momentValue?: number;
}

export interface BaseFile {
  id: string;
  type: string;
}

export interface UnzippedFile extends BaseFile {
  fileName: string;
  size: number;
  fullPath: string;
  type: 'UnzippedFile';
}

export type UnzippedFiles = Array<UnzippedFile>;

export type MergedLogFiles = Record<SelectableLogType, MergedLogFile>;

export interface ProcessedLogFile extends BaseFile {
  levelCounts: Record<string, number>;
  repeatedCounts: RepeatedCounts;
  logEntries: Array<LogEntry>;
  logFile: UnzippedFile;
  logType: KnownLogType;
  type: 'ProcessedLogFile';
}

export interface MergedLogFile extends BaseFile {
  logFiles: Array<ProcessedLogFile>;
  logEntries: Array<LogEntry>;
  logType: SelectableLogType;
  type: 'MergedLogFile';
}

export type Suggestion = ValidSuggestion | InvalidSuggestion;

export interface ValidSuggestion extends fs.Stats {
  age: string;
  filePath: string;
  birthtimeMs: number;
  platform: string;
  appVersion: string;
  instanceUuid: string;
  hasTrace?: boolean;
  hasNetLog?: boolean;
}

export interface InvalidSuggestion extends fs.Stats {
  filePath: string;
  error: Error;
}

export enum LogLevel {
  debug = 'debug',
  info = 'info',
  warn = 'warn',
  error = 'error',
}

export type LevelFilter = Record<LogLevel, boolean>;
export type LogTypeFilter = Record<ProcessableLogType, boolean>;
export type LogMetrics = Record<LogLevel, number>;
export type TimeBucketedLogMetrics = Record<number, LogMetrics>;

export interface RootState {
  settings?: {
    releaseChannelOverride: string;
  };
}

/**
 * Context menu actions that can be taken on a specific log line.
 */
export enum LogLineContextMenuActions {
  COPY_TO_CLIPBOARD,
  OPEN_SOURCE,
}

/**
 * Supported trace viewers
 */
export enum TRACE_VIEWER {
  CHROME_DEVTOOLS = 'chrome-devtools',
  PERFETTO = 'perfetto',
}

/**
 * A batch of new log entries parsed from a single watched file.
 */
export interface LiveTailUpdate {
  fileId: string;
  newEntries: LogEntry[];
  levelCountDeltas: Record<string, number>;
  repeatedCountDeltas: Record<string, number>;
  byteOffset: number;
  totalLines: number;
}

/**
 * A newly-discovered file that appeared while the live tail watcher was running.
 */
export interface LiveTailNewFile {
  file: UnzippedFile;
  logType: KnownLogType;
}

/**
 * IPC payload sent from main to renderer on each live tail flush.
 */
export interface LiveTailUpdatePayload {
  updates: LiveTailUpdate[];
  newFiles: LiveTailNewFile[];
}
