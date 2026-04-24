import debug from 'debug';

import { LogEntry, LogLevel, LogType, MatchResult } from '../../interfaces';
import { makeLogEntry } from './read-file';

const d = debug('sleuth:line-parser');

const MAX_TO_PARSE = 100_000;

/**
 * Result of feeding lines into a LineParser — new entries plus counter deltas.
 */
export interface LineParserResult {
  newEntries: LogEntry[];
  levelCountDeltas: Record<string, number>;
  repeatedCountDeltas: Record<string, number>;
}

/**
 * Incremental log line parser. Accepts raw lines, applies a match function
 * to extract structured LogEntry objects, collapses repeated messages,
 * and tracks level/repeated count deltas for each batch.
 */
export class LineParser {
  private current: LogEntry | null = null;
  private toParse = '';
  private lines = 0;
  private entryCount = 0;
  private entries: LogEntry[] = [];
  private levelCountDeltas: Record<LogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };
  private repeatedCountDeltas: Record<string, number> = {};
  private lastPushedEntry: LogEntry | null = null;

  constructor(
    private readonly matchFn: (
      line: string,
      userTZ?: string,
    ) => MatchResult | undefined,
    private readonly logType: LogType,
    private readonly sourceFile: string,
    private readonly fileName: string,
    private readonly userTZ?: string,
    initialEntryCount = 0,
    initialLineCount = 0,
    lastEntry?: LogEntry,
  ) {
    this.entryCount = initialEntryCount;
    this.lines = initialLineCount;
    this.lastPushedEntry = lastEntry ?? null;
  }

  /** Parse a batch of raw lines, returning new entries and counter deltas. */
  feedLines(lines: string[]): LineParserResult {
    this.entries = [];
    this.levelCountDeltas = { debug: 0, info: 0, warn: 0, error: 0 };
    this.repeatedCountDeltas = {};

    for (const line of lines) {
      this.readLine(line);
    }

    return {
      newEntries: this.entries,
      levelCountDeltas: this.levelCountDeltas,
      repeatedCountDeltas: this.repeatedCountDeltas,
    };
  }

  /** Flush any buffered partial entry (e.g. trailing multi-line meta). */
  finalize(): LineParserResult {
    this.entries = [];
    this.levelCountDeltas = { debug: 0, info: 0, warn: 0, error: 0 };
    this.repeatedCountDeltas = {};

    if (this.current && this.toParse.length > 0) {
      this.current.meta = this.toParse;
    }
    this.pushEntry(this.current);
    this.current = null;
    this.toParse = '';

    return {
      newEntries: this.entries,
      levelCountDeltas: this.levelCountDeltas,
      repeatedCountDeltas: this.repeatedCountDeltas,
    };
  }

  get totalLines(): number {
    return this.lines;
  }

  get totalEntries(): number {
    return this.entryCount;
  }

  private pushEntry(entry: LogEntry | null) {
    if (!entry) return;

    const previous =
      this.entries.length > 0
        ? this.entries[this.entries.length - 1]
        : this.lastPushedEntry;

    if (
      previous &&
      previous.timestamp &&
      previous.momentValue &&
      entry.timestamp.startsWith('No Date B') &&
      entry.momentValue === 0
    ) {
      entry.timestamp = previous.timestamp;
      entry.momentValue = previous.momentValue;
    } else if (
      previous &&
      previous.timestamp &&
      previous.momentValue &&
      entry.timestamp.startsWith('No Date C') &&
      entry.momentValue === 0
    ) {
      const newTimestamp =
        previous.timestamp.substring(0, 16) + entry.timestamp.substring(9);
      const newDate = new Date(newTimestamp);
      entry.timestamp = newTimestamp;
      entry.momentValue = newDate.valueOf();
    }

    if (
      previous &&
      previous.message === entry.message &&
      previous.meta === entry.meta
    ) {
      if (this.entries.length > 0) {
        const last = this.entries[this.entries.length - 1];
        last.repeated = last.repeated || [];
        last.repeated.push(entry.timestamp);
      } else if (this.lastPushedEntry) {
        this.lastPushedEntry.repeated = this.lastPushedEntry.repeated || [];
        this.lastPushedEntry.repeated.push(entry.timestamp);
      }
      this.repeatedCountDeltas[entry.message] =
        (this.repeatedCountDeltas[entry.message] || 0) + 1;
    } else {
      entry.index = this.entryCount;
      this.entryCount += 1;

      if (entry.level) {
        this.levelCountDeltas[entry.level] =
          (this.levelCountDeltas[entry.level] || 0) + 1;
      }

      this.entries.push(entry);
      this.lastPushedEntry = entry;
    }
  }

  private readLine(line: string) {
    this.lines += 1;
    if (!line || line.length === 0) return;

    const matched = this.matchFn(line, this.userTZ);

    if (matched) {
      if (this.current && this.toParse.length > 0) {
        this.current.meta = this.toParse;
      }
      this.pushEntry(this.current);

      this.toParse = matched.toParseHead || '';
      this.current = makeLogEntry(
        matched,
        this.logType,
        this.lines,
        this.sourceFile,
      );
    } else {
      if (this.logType === 'mobile' && this.current) {
        this.current.message += '\n' + line;
      } else if (
        this.current &&
        (this.fileName.startsWith('app.slack') ||
          this.fileName.startsWith('console-export-'))
      ) {
        if (
          this.toParse &&
          this.toParse.length > 0 &&
          this.toParse.length < MAX_TO_PARSE
        ) {
          this.toParse += line + '\n';
        } else if (
          this.toParse.length < MAX_TO_PARSE &&
          (line.includes('@') ||
            line.includes('(async)') ||
            line.match(/Show [\d]+ more frames/))
        ) {
          this.toParse += line + '\n';
        } else {
          this.current.message += '\n' + line;
        }
      } else if (this.toParse.length < MAX_TO_PARSE) {
        this.toParse += line + '\n';
      } else if (!this.toParse.endsWith('[truncated]\n')) {
        d(
          'Meta accumulation exceeded %d bytes for entry at line %d in %s, truncating',
          MAX_TO_PARSE,
          this.current?.line,
          this.fileName,
        );
        this.toParse += '[truncated]\n';
      }
    }
  }
}
