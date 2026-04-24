import fs from 'node:fs';
import path from 'node:path';
import readline from 'readline';
import debug from 'debug';

import {
  KnownLogType,
  LiveTailUpdate,
  LiveTailUpdatePayload,
  LOG_TYPES_TO_PROCESS,
  LogType,
  UnzippedFile,
  UnzippedFiles,
} from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { shouldIgnoreFile } from '../../utils/should-ignore-file';
import { getTypeForFile } from '../../utils/get-file-types';
import { getMatchFunction, readLogFile } from './read-file';
import { LineParser } from './line-parser';

const d = debug('sleuth:live-tail');

const FLUSH_DEBOUNCE_MS = 200;

const PROCESSABLE_SET = new Set<string>(
  LOG_TYPES_TO_PROCESS as readonly string[],
);

interface WatchedFile {
  watcher: fs.FSWatcher;
  byteOffset: number;
  parser: LineParser;
  logType: KnownLogType;
  file: UnzippedFile;
}

export class LiveTailWatcher {
  private directoryWatchers: fs.FSWatcher[] = [];
  private watchedFiles = new Map<string, WatchedFile>();
  private pendingUpdates: LiveTailUpdate[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly logsPath: string,
    private readonly webContents: Electron.WebContents,
    private readonly userTZ?: string,
  ) {}

  async start(): Promise<UnzippedFiles> {
    const allFiles = await this.scanDirectory();

    for (const file of allFiles) {
      const logType = getTypeForFile(file);
      if (logType === LogType.UNKNOWN || !PROCESSABLE_SET.has(logType)) {
        continue;
      }

      const stats = fs.statSync(file.fullPath);

      const parser = new LineParser(
        getMatchFunction(logType, file),
        logType,
        file.fullPath,
        file.fileName,
        this.userTZ,
      );

      const watcher = fs.watch(file.fullPath, () => {
        this.onFileChange(file.fullPath);
      });

      this.watchedFiles.set(file.fullPath, {
        watcher,
        byteOffset: stats.size,
        parser,
        logType: logType as KnownLogType,
        file,
      });
    }

    for (const dir of this.watchedDirs) {
      const watcher = fs.watch(dir, (_event, filename) => {
        if (filename) {
          this.onDirectoryChange(dir, filename);
        }
      });
      this.directoryWatchers.push(watcher);
    }

    d(
      'Watching %d files in %d directories',
      this.watchedFiles.size,
      this.watchedDirs.length,
    );
    return allFiles;
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;

    d('Stopping live tail');

    for (const watcher of this.directoryWatchers) {
      watcher.close();
    }
    this.directoryWatchers = [];

    for (const [, watched] of this.watchedFiles) {
      watched.watcher.close();
    }
    this.watchedFiles.clear();

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingUpdates = [];
  }

  private watchedDirs: string[] = [];

  private async scanDirectory(): Promise<UnzippedFiles> {
    const files: UnzippedFiles = [];
    const dirsToScan = [this.logsPath];

    const topEntries = await fs.promises.readdir(this.logsPath);
    for (const entry of topEntries) {
      const fullPath = path.join(this.logsPath, entry);
      try {
        if (fs.statSync(fullPath).isDirectory() && !shouldIgnoreFile(entry)) {
          dirsToScan.push(fullPath);
        }
      } catch {
        d('Failed to stat %s, skipping', fullPath);
      }
    }

    this.watchedDirs = dirsToScan;

    for (const dir of dirsToScan) {
      const entries = await fs.promises.readdir(dir);
      for (const fileName of entries) {
        if (shouldIgnoreFile(fileName)) continue;
        const fullPath = path.join(dir, fileName);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            files.push({
              fileName,
              fullPath,
              size: stats.size,
              id: fullPath,
              type: 'UnzippedFile',
            });
          }
        } catch {
          d('Failed to stat %s, skipping', fullPath);
        }
      }
    }
    return files;
  }

  private onFileChange(fullPath: string) {
    if (this.stopped) return;

    const watched = this.watchedFiles.get(fullPath);
    if (!watched) return;

    let newSize: number;
    try {
      newSize = fs.statSync(fullPath).size;
    } catch {
      return;
    }

    if (newSize <= watched.byteOffset) {
      if (newSize < watched.byteOffset) {
        d('File %s was truncated/rotated, resetting', fullPath);
        this.resetFile(watched);
      }
      return;
    }

    this.readIncremental(watched, newSize);
  }

  private readIncremental(watched: WatchedFile, newSize: number) {
    const readStream = fs.createReadStream(watched.file.fullPath, {
      start: watched.byteOffset,
    });

    const rl = readline.createInterface({
      input: readStream,
      terminal: false,
    });

    const lines: string[] = [];
    rl.on('line', (line) => lines.push(line));

    rl.on('close', () => {
      if (this.stopped || lines.length === 0) return;

      const result = watched.parser.feedLines(lines);
      watched.byteOffset = newSize;

      if (result.newEntries.length > 0) {
        this.pendingUpdates.push({
          fileId: watched.file.fullPath,
          newEntries: result.newEntries,
          levelCountDeltas: result.levelCountDeltas,
          repeatedCountDeltas: result.repeatedCountDeltas,
          byteOffset: newSize,
          totalLines: watched.parser.totalLines,
        });

        this.scheduleFlush();
      }
    });
  }

  private async resetFile(watched: WatchedFile) {
    watched.watcher.close();

    const logType = watched.logType;
    const file = watched.file;

    const result = await readLogFile(file, {
      logType,
      userTZ: this.userTZ,
    });

    const stats = fs.statSync(file.fullPath);
    const lastEntry =
      result.entries.length > 0
        ? result.entries[result.entries.length - 1]
        : undefined;

    watched.parser = new LineParser(
      getMatchFunction(logType, file),
      logType,
      file.fullPath,
      file.fileName,
      this.userTZ,
      result.entries.length,
      result.lines,
      lastEntry,
    );
    watched.byteOffset = stats.size;
    watched.watcher = fs.watch(file.fullPath, () => {
      this.onFileChange(file.fullPath);
    });
  }

  private async onDirectoryChange(parentDir: string, filename: string) {
    if (this.stopped) return;

    const fullPath = path.join(parentDir, filename);

    if (this.watchedFiles.has(fullPath)) return;
    if (shouldIgnoreFile(filename)) return;

    let stats: fs.Stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      return;
    }
    if (!stats.isFile()) return;

    const file: UnzippedFile = {
      fileName: filename,
      fullPath,
      size: stats.size,
      id: fullPath,
      type: 'UnzippedFile',
    };

    const logType = getTypeForFile(file);
    if (logType === LogType.UNKNOWN || !PROCESSABLE_SET.has(logType)) return;

    d('New file detected: %s (type: %s)', filename, logType);

    const parser = new LineParser(
      getMatchFunction(logType, file),
      logType,
      fullPath,
      filename,
      this.userTZ,
    );

    const watcher = fs.watch(fullPath, () => {
      this.onFileChange(fullPath);
    });

    this.watchedFiles.set(fullPath, {
      watcher,
      byteOffset: stats.size,
      parser,
      logType: logType as KnownLogType,
      file,
    });
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), FLUSH_DEBOUNCE_MS);
  }

  private flush() {
    this.flushTimer = null;
    if (this.stopped || this.pendingUpdates.length === 0) return;

    const payload: LiveTailUpdatePayload = {
      updates: this.pendingUpdates,
      newFiles: [],
    };

    this.pendingUpdates = [];

    try {
      if (!this.webContents.isDestroyed()) {
        this.webContents.send(IpcEvents.LIVE_TAIL_UPDATE, payload);
      }
    } catch (error) {
      d('flush: send failed', error);
    }
  }
}
