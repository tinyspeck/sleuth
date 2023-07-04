import fs from 'fs-extra';

// Anything that's valid as a "selected" log file. We started with just
// actual files  and have since added the "Tool" enum for, well, tools.
export type SelectableLogFile = LogFile | Tool | UnzippedFile;

export type LogFile = MergedLogFile | ProcessedLogFile;

export type RepeatedCounts = Record<string, number>;

export enum LogType {
  ALL = 'all',
  BROWSER = 'browser',
  RENDERER = 'renderer',
  PRELOAD = 'preload',
  WEBAPP = 'webapp',
  STATE = 'state',
  CALL = 'call',
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
  LogType.RENDERER,
  LogType.WEBAPP,
  LogType.PRELOAD,
  LogType.CALL,
  LogType.INSTALLER,
  LogType.MOBILE,
  LogType.CHROMIUM
] as const;

export type ProcessableLogType = (typeof LOG_TYPES_TO_PROCESS)[number];

export type RawLogType = Exclude<KnownLogType, ProcessableLogType>;

export type ProcessedLogFiles = Record<ProcessableLogType, Array<ProcessedLogFile>> & Record<RawLogType, Array<UnzippedFile>>;
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
export type CompressedBookmark = [ number, number, string, number ];

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

export interface LogEntry {
  index: number;
  timestamp: string;
  message: string;
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

export type UnzippedFiles = Array<UnzippedFile>

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

export interface MergedFilesLoadStatus {
  all: boolean;
  browser: boolean;
  renderer: boolean;
  preload: boolean;
  webapp: boolean;
  call: boolean;
  mobile: boolean;
}

export interface Suggestion extends fs.Stats {
  age: string;
  filePath: string;
  birthtimeMs: number;
}

export enum LogLevel {
  debug = 'debug',
  info = 'info',
  warn = 'warn',
  error = 'error'
}

export type LevelFilter = Record<LogLevel, boolean>;
export type LogMetrics = Record<LogLevel, number>;
export type TimeBucketedLogMetrics = Record<number, LogMetrics>;

export interface TouchBarLogFileUpdate {
  levelCounts: Record<string, number>;
  isLogFile: boolean;
}

export enum Tool {
  cache = 'cache'
}

export interface RootState {
  settings?: {
    releaseChannelOverride: string;
  }
}
