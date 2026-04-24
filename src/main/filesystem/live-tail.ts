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
    console.log('[live-tail] start() called, logsPath:', this.logsPath);

    const allFiles = await this.scanDirectory();
    console.log(
      '[live-tail] scanDirectory found %d files across %d dirs',
      allFiles.length,
      this.watchedDirs.length,
    );
    const tailableFiles: UnzippedFile[] = [];

    for (const file of allFiles) {
      const logType = getTypeForFile(file);
      if (logType === LogType.UNKNOWN || !PROCESSABLE_SET.has(logType)) {
        continue;
      }

      const result = await readLogFile(file, {
        logType,
        userTZ: this.userTZ,
      });

      const stats = fs.statSync(file.fullPath);
      const lastEntry =
        result.entries.length > 0
          ? result.entries[result.entries.length - 1]
          : undefined;

      const parser = new LineParser(
        getMatchFunction(logType, file),
        logType,
        file.fullPath,
        file.fileName,
        this.userTZ,
        result.entries.length,
        result.lines,
        lastEntry,
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

      tailableFiles.push(file);
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

    console.log('[live-tail] scanDirectory: reading', this.logsPath);
    const topEntries = await fs.promises.readdir(this.logsPath);
    console.log('[live-tail] top-level entries:', topEntries);
    for (const entry of topEntries) {
      const fullPath = path.join(this.logsPath, entry);
      try {
        const isDir = fs.statSync(fullPath).isDirectory();
        console.log(
          '[live-tail]   entry=%s isDir=%s ignore=%s',
          entry,
          isDir,
          shouldIgnoreFile(entry),
        );
        if (isDir && !shouldIgnoreFile(entry)) {
          dirsToScan.push(fullPath);
        }
      } catch (err) {
        console.log('[live-tail]   stat failed for', fullPath, err);
      }
    }

    console.log('[live-tail] dirsToScan:', dirsToScan);
    this.watchedDirs = dirsToScan;

    for (const dir of dirsToScan) {
      const entries = await fs.promises.readdir(dir);
      console.log('[live-tail] dir=%s has %d entries', dir, entries.length);
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
    console.log('[live-tail] scanDirectory returning %d files', files.length);

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

    console.log(
      '[live-tail] onFileChange %s: prev=%d new=%d',
      path.basename(fullPath),
      watched.byteOffset,
      newSize,
    );

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

    const result = await readLogFile(file, { logType, userTZ: this.userTZ });
    const newStats = fs.statSync(fullPath);
    const lastEntry =
      result.entries.length > 0
        ? result.entries[result.entries.length - 1]
        : undefined;

    const parser = new LineParser(
      getMatchFunction(logType, file),
      logType,
      fullPath,
      filename,
      this.userTZ,
      result.entries.length,
      result.lines,
      lastEntry,
    );

    const watcher = fs.watch(fullPath, () => {
      this.onFileChange(fullPath);
    });

    this.watchedFiles.set(fullPath, {
      watcher,
      byteOffset: newStats.size,
      parser,
      logType: logType as KnownLogType,
      file,
    });

    if (result.entries.length > 0) {
      this.pendingUpdates.push({
        fileId: fullPath,
        newEntries: result.entries,
        levelCountDeltas: result.entries.reduce(
          (acc, e) => {
            if (e.level) acc[e.level] = (acc[e.level] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        repeatedCountDeltas: {},
        byteOffset: newStats.size,
        totalLines: result.lines,
      });
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), FLUSH_DEBOUNCE_MS);
  }

  private flush() {
    this.flushTimer = null;
    if (this.stopped || this.pendingUpdates.length === 0) return;

    const totalNewEntries = this.pendingUpdates.reduce(
      (sum, u) => sum + u.newEntries.length,
      0,
    );
    console.log(
      '[live-tail] flush: %d updates, %d total new entries',
      this.pendingUpdates.length,
      totalNewEntries,
    );

    const payload: LiveTailUpdatePayload = {
      updates: this.pendingUpdates,
      newFiles: [],
    };

    this.pendingUpdates = [];

    try {
      if (!this.webContents.isDestroyed()) {
        this.webContents.send(IpcEvents.LIVE_TAIL_UPDATE, payload);
      } else {
        console.log('[live-tail] flush: webContents is destroyed, skipping');
      }
    } catch (error) {
      console.error('[live-tail] flush: send failed', error);
    }
  }
}
