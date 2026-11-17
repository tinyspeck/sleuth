import { describe, expect, it } from 'vitest';
import { LogLevel } from '../../src/interfaces';
import {
  formatDesktopTimestamp,
  formatLogArgs,
  formatLogLine,
} from '../../src/utils/log-format';
import { matchLineElectron } from '../../src/main/filesystem/read-file';
import { matchTag } from '../../src/utils/match-tag';

describe('log-format', () => {
  const date = new Date(2026, 10, 12, 14, 2, 33, 371);

  it('formats a Slack Desktop style timestamp', () => {
    expect(formatDesktopTimestamp(date)).toBe('11/12/26, 14:02:33:371');
    expect(formatDesktopTimestamp(new Date(2026, 0, 1, 0, 0, 0, 7))).toBe(
      '01/01/26, 00:00:00:007',
    );
  });

  it('produces a line matchLineElectron can parse back', () => {
    const line = formatLogLine(LogLevel.info, 'Store', 'UPDATE_SETTINGS', date);
    expect(line).toBe('[11/12/26, 14:02:33:371] info: Store: UPDATE_SETTINGS');

    // Sleuth recovers the zone from `systemTZ` in log-context.json, which the
    // main-process logger writes from the same source.
    const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = matchLineElectron(line, systemTZ);
    expect(match).toBeDefined();
    expect(match?.level).toBe('info');
    expect(match?.message?.trim()).toBe('Store: UPDATE_SETTINGS');
    expect(match?.momentValue).toBe(date.getTime());
  });

  it('keeps the tag extractable via matchTag', () => {
    const line = formatLogLine(
      LogLevel.warn,
      'Windows',
      'Created window',
      date,
    );
    const match = matchLineElectron(line);
    expect(matchTag(match?.message ?? '')?.[1]).toBe('Windows');
  });

  it('joins mixed args onto one line', () => {
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at foo\n    at bar';
    expect(formatLogArgs(['Failed', { key: 'a', value: 1 }, err])).toBe(
      'Failed {"key":"a","value":1} Error: boom | at foo | at bar',
    );
    expect(formatLogArgs([undefined, 42, null])).toBe('undefined 42 null');
  });

  it('substitutes printf-style placeholders', () => {
    expect(formatLogArgs(['Watching %d files in %d directories', 3, 1])).toBe(
      'Watching 3 files in 1 directories',
    );
    expect(formatLogArgs(['New file: %s (type: %s)', 'a.log', 'browser'])).toBe(
      'New file: a.log (type: browser)',
    );
    expect(formatLogArgs(['%s is 100%% done', 'job', { extra: true }])).toBe(
      'job is 100% done {"extra":true}',
    );
    expect(formatLogArgs(['no args %s'])).toBe('no args %s');
  });
});
