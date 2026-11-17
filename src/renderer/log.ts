import { LogLevel } from '../interfaces';
import { formatLogArgs, LogTag } from '../utils/log-format';
import type { Logger } from '../main/log';

export type { Logger };

/**
 * Renderer-side tagged logger. Lines are forwarded over IPC to the main
 * process, which writes them into Sleuth's own `browser.log` alongside main
 * process output so the two interleave chronologically like Desktop's.
 */
export function createLogger(tag: LogTag): Logger {
  const write =
    (level: LogLevel) =>
    (...args: unknown[]) => {
      const message = formatLogArgs(args);
      // Mirror to DevTools so renderer logs stay inspectable in development
      (level === LogLevel.debug ? console.debug : console[level])(
        `${tag}: ${message}`,
      );
      window.Sleuth.log(level, tag, message);
    };
  return {
    debug: write(LogLevel.debug),
    info: write(LogLevel.info),
    warn: write(LogLevel.warn),
    error: write(LogLevel.error),
  };
}
