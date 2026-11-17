import { LogLevel } from '../interfaces';

export type LogTag = string;

/**
 * Formats a single log line in the Slack Desktop `browser.log` shape that
 * Sleuth's own `matchLineElectron` parser expects:
 *
 *   [02/22/17, 16:02:33:371] info: Store: UPDATE_SETTINGS
 *
 * The timestamp is wall-clock local time, matching Desktop. Sleuth recovers
 * the zone from the `systemTZ` key in `log-context.json`.
 */
export function formatLogLine(
  level: LogLevel,
  tag: LogTag,
  message: string,
  date: Date = new Date(),
): string {
  return `[${formatDesktopTimestamp(date)}] ${level}: ${tag}: ${message}`;
}

export function formatDesktopTimestamp(date: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  const p3 = (n: number) => String(n).padStart(3, '0');
  const mm = p2(date.getMonth() + 1);
  const dd = p2(date.getDate());
  const yy = p2(date.getFullYear() % 100);
  return `${mm}/${dd}/${yy}, ${p2(date.getHours())}:${p2(date.getMinutes())}:${p2(date.getSeconds())}:${p3(date.getMilliseconds())}`;
}

/**
 * Joins console-style log arguments into a single-line string. Errors keep
 * their message and stack, objects are JSON-serialised, and everything else
 * is stringified. Supports the printf-style placeholders (`%s`, `%d`, `%o`,
 * `%O`, `%j`) that `console.log` and `debug` accept in the first argument.
 */
export function formatLogArgs(args: unknown[]): string {
  const [first, ...rest] = args;
  if (typeof first !== 'string' || rest.length === 0) {
    return args.map(formatLogArg).join(' ');
  }

  const head = first.replace(/%[sdoOj%]/g, (token) => {
    if (token === '%%') return '%';
    return rest.length > 0 ? formatLogArg(rest.shift()) : token;
  });
  return [head, ...rest.map(formatLogArg)].join(' ');
}

function formatLogArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) {
    return arg.stack ? arg.stack.replace(/\n\s*/g, ' | ') : arg.message;
  }
  if (arg === undefined) return 'undefined';
  try {
    return JSON.stringify(arg, (_key, value) =>
      value instanceof Error
        ? { message: value.message, stack: value.stack }
        : value,
    );
  } catch {
    return String(arg);
  }
}
