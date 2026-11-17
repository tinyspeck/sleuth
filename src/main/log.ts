import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

import { LogLevel } from '../interfaces';
import { formatLogArgs, formatLogLine, LogTag } from '../utils/log-format';

/** Rotate `browser.log` once it exceeds this many bytes, same ballpark as Desktop. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Keep `browser.log` plus `browser1.log` … `browser{N}.log`. */
const MAX_ROTATED_FILES = 3;

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/** `{appData}/Sleuth/logs`, mirroring Desktop's `{appData}/Slack/logs`. */
export function getSleuthLogsPath(): string {
  return path.join(app.getPath('userData'), 'logs');
}

let logsDir: string | null = null;
let stream: fs.WriteStream | null = null;
let bytesWritten = 0;

function ensureStream(): fs.WriteStream {
  if (stream) return stream;

  logsDir = getSleuthLogsPath();
  fs.mkdirSync(logsDir, { recursive: true });
  writeLogContext(logsDir);

  const file = path.join(logsDir, 'browser.log');
  bytesWritten = fs.existsSync(file) ? fs.statSync(file).size : 0;
  stream = fs.createWriteStream(file, { flags: 'a' });
  return stream;
}

/** Desktop ships `log-context.json` with the machine's zone; Sleuth reads `systemTZ` from it. */
function writeLogContext(dir: string) {
  const context = {
    systemTZ: Intl.DateTimeFormat().resolvedOptions().timeZone,
    sleuthVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  };
  fs.writeFileSync(
    path.join(dir, 'log-context.json'),
    JSON.stringify(context, null, 2),
  );
}

function rotate() {
  if (!logsDir || !stream) return;
  stream.end();
  stream = null;

  for (let i = MAX_ROTATED_FILES; i >= 1; i--) {
    const from = path.join(
      logsDir,
      i === 1 ? 'browser.log' : `browser${i - 1}.log`,
    );
    const to = path.join(logsDir, `browser${i}.log`);
    if (fs.existsSync(from)) fs.renameSync(from, to);
  }
  bytesWritten = 0;
}

export function writeLogLine(level: LogLevel, tag: LogTag, message: string) {
  const line = formatLogLine(level, tag, message) + '\n';
  // `app` is undefined under vitest's electron mock
  if (!app?.isPackaged) {
    // Keep DevTools / terminal output in development
    (level === LogLevel.debug ? console.debug : console[level])(line.trimEnd());
  }
  if (!app) return;
  try {
    if (bytesWritten > MAX_FILE_BYTES) rotate();
    ensureStream().write(line);
    bytesWritten += Buffer.byteLength(line);
  } catch {
    // Logging must never take the app down
  }
}

/**
 * Creates a tagged logger. The tag becomes the `Store:`-style prefix Sleuth
 * extracts via `matchTag()` for sidebar filtering and colouring.
 */
export function createLogger(tag: LogTag): Logger {
  const write =
    (level: LogLevel) =>
    (...args: unknown[]) =>
      writeLogLine(level, tag, formatLogArgs(args));
  return {
    debug: write(LogLevel.debug),
    info: write(LogLevel.info),
    warn: write(LogLevel.warn),
    error: write(LogLevel.error),
  };
}
