import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { UnzippedFile, LogType } from '../../src/interfaces';
import {
  matchLineElectron,
  matchLineWebApp,
  matchLineConsole,
  matchLineIOS,
  matchLineAndroid,
  matchLineMobile,
  matchLineSquirrel,
  matchLineShipItMac,
  matchLineChromium,
  getMatchFunction,
  makeLogEntry,
  readLogFile,
} from '../../src/main/filesystem/read-file';
import dirtyJSON from 'jsonic';

describe('matchLineWebApp', () => {
  it('should match a classic webapp line', () => {
    const line =
      'info: 2017/2/22 16:02:37.178 didStartLoading TSSSB.timeout_tim set for ms:60000';
    const result = matchLineWebApp(line);

    expect(result).toMatchObject({
      timestamp: '2017/2/22 16:02:37.178',
      level: 'info',
      message: 'didStartLoading TSSSB.timeout_tim set for ms:60000',
    });
  });
});

describe('matchLineElectron', () => {
  it('should match an Electron (>= 2.6) line', () => {
    const line = '[02/22/17, 16:02:33:371] info: Store: UPDATE_SETTINGS';
    const result = matchLineElectron(line);

    expect(result).toMatchObject({
      timestamp: '02/22/17, 16:02:33:371',
      level: 'info',
      message: ' Store: UPDATE_SETTINGS',
    });
  });
});

describe('readFile', () => {
  it('should read a browser.log file and create log entries', () => {
    const file: UnzippedFile = {
      type: 'UnzippedFile',
      id: '123',
      fullPath: path.join(__dirname, '../static/browser.log'),
      fileName: 'browser.log',
      size: 1713,
    };

    return readLogFile(file, { logType: LogType.BROWSER }).then(
      ({ entries }) => {
        expect(entries).toHaveLength(13);
        expect(entries[0]).toMatchObject({
          timestamp: '02/22/17, 16:02:32:675',
          level: 'info',
          momentValue: expect.any(Number),
          logType: LogType.BROWSER,
          index: 0,
        });

        expect(entries[4]).toHaveProperty('meta');

        const parsedMeta = dirtyJSON(entries[4].meta);
        expect(parsedMeta.isDevMode).toBe(true);
      },
    );
  });

  it('should read a webapp.log file and create log entries', () => {
    const file: UnzippedFile = {
      type: 'UnzippedFile',
      id: '123',
      fullPath: path.join(__dirname, '../static/webapp.log'),
      fileName: 'webapp.log',
      size: 1713,
    };

    return readLogFile(file, { logType: LogType.WEBAPP }).then(
      ({ entries }) => {
        expect(entries).toHaveLength(4);
        // Can parse JSON meta
        expect(JSON.parse(entries[3].meta as string)).toEqual({
          viewSet: {
            sidebar: { id: 'ChannelList', viewType: 'ChannelList' },
            primary: { id: 'Punreads', viewType: 'Page' },
          },
          nextTab: 'home',
        });
      },
    );
  });
});

describe('makeLogEntry', () => {
  it('should make a log entry (duh)', () => {
    const options = {
      timestamp: '1',
      level: 'info',
      meta: '{}',
      toParseHead: '{',
      momentValue: 1,
    };

    const result = makeLogEntry(options, 'browser', 1, 'test-file');
    expect(result).toMatchObject({
      message: '',
      timestamp: '1',
    });
  });
});

describe('matchLineWebApp (additional)', () => {
  it('should match DESKTOP_RGX format with embedded JSON', () => {
    const line =
      '[01/12/21, 13:05:05:353] INFO [COUNTS] (T29KZ003T) {"count":5}';
    const result = matchLineWebApp(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('info');
    expect(result!.meta).toBe('{"count":5}');
  });

  it('should match WEBAPP_A format (Mon-DD timestamp)', () => {
    const line = 'info: Mar-19 13:50:41.676 [FOCUS-EVENT] Window focused';
    const result = matchLineWebApp(line);

    expect(result).toBeDefined();
    expect(result!.timestamp).toBe('Mar-19 13:50:41.676');
    expect(result!.level).toBe('info');
    expect(result!.message).toBe('[FOCUS-EVENT] Window focused');
  });

  it('should return undefined for lines starting with {', () => {
    const line = '{"key": "value"}';
    expect(matchLineWebApp(line)).toBeUndefined();
  });

  it('should handle 24:xx midnight timestamps', () => {
    const line = '[01/12/21, 24:13:05:353] INFO some message';
    const result = matchLineWebApp(line);

    expect(result).toBeDefined();
    // 24: is replaced with 00: → Date.UTC(2021, 0, 12, 0, 13, 5, 353)
    expect(result!.momentValue).toBe(Date.UTC(2021, 0, 12, 0, 13, 5, 353));
  });
});

describe('matchLineElectron (additional)', () => {
  it('should return undefined for lines starting with {', () => {
    const line = '{"key": "value"}';
    expect(matchLineElectron(line)).toBeUndefined();
  });

  it('should handle 24:xx midnight timestamps', () => {
    const line = '[01/12/21, 24:13:05:353] info: Late night message';
    const result = matchLineElectron(line);

    expect(result).toBeDefined();
    // 24: is replaced with 00: → Date.UTC(2021, 0, 12, 0, 13, 5, 353)
    expect(result!.momentValue).toBe(Date.UTC(2021, 0, 12, 0, 13, 5, 353));
  });
});

describe('matchLineConsole', () => {
  it('should match CONSOLE_A format (Mon-DD timestamp)', () => {
    const line =
      'Sep-24 14:36:07.809 [API-Q] (T34263EUF) conversations.history called';
    const result = matchLineConsole(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('info');
    expect(result!.message).toContain('conversations.history called');
    expect(result!.momentValue).toEqual(expect.any(Number));
  });

  it('should match CONSOLE_A format with source prefix', () => {
    const line =
      'gantry-shared.75d2ab5.min.js:1 Sep-24 14:40:32.318 Notification suppressed';
    const result = matchLineConsole(line);

    expect(result).toBeDefined();
    expect(result!.message).toContain('Notification suppressed');
    expect(result!.message).toContain('<gantry-shared');
  });

  it('should match CONSOLE_B format (no timestamp)', () => {
    const line =
      'edgeapi.slack.com/cache/E12KS1G65:1 Failed to load resource: net::ERR_TIMED_OUT';
    const result = matchLineConsole(line);

    expect(result).toBeDefined();
    expect(result!.timestamp).toBe('No Date B');
    expect(result!.momentValue).toBe(0);
    expect(result!.message).toContain('Failed to load resource');
  });

  it('should match CONSOLE_C format (time only, no date)', () => {
    const line = '11:50:09.731 Exposing workspace desktop delegate';
    const result = matchLineConsole(line);

    expect(result).toBeDefined();
    expect(result!.timestamp).toMatch(/^No Date C/);
    expect(result!.momentValue).toBe(0);
    expect(result!.message).toContain('Exposing workspace');
  });

  it('should match CONSOLE_C format with source', () => {
    const line =
      '11:50:10.297 gantry-shared.f1348ec.min.js:1 [API-Q] Flannel is RESOLVED';
    const result = matchLineConsole(line);

    expect(result).toBeDefined();
    expect(result!.message).toContain('<gantry-shared');
  });

  it('should skip stack trace lines containing @', () => {
    const line = '    someFunction@https://a.slack-edge.com/file.js:123:45';
    expect(matchLineConsole(line)).toBeUndefined();
  });

  it('should skip stack trace lines containing (async)', () => {
    const line = '    (async) someAsyncFunction';
    expect(matchLineConsole(line)).toBeUndefined();
  });

  it('should skip "Show N more frames" lines', () => {
    const line = 'Show 12 more frames';
    expect(matchLineConsole(line)).toBeUndefined();
  });
});

describe('matchLineIOS', () => {
  it('should match IOS_A format (newest timestamp)', () => {
    const line =
      '[2019-01-30 T08:29:56.123456 -05:00] [INFO] Starting application';
    const result = matchLineIOS(line);

    expect(result).toBeDefined();
    expect(result!.timestamp).toBe('2019-01-30 08:29:56');
    expect(result!.level).toBe('info');
    expect(result!.momentValue).toEqual(expect.any(Number));
    expect(Number.isNaN(result!.momentValue)).toBe(false);
  });

  it('should map ERR level in IOS_A format', () => {
    const line = '[2019-01-30 T08:29:56.123456 -05:00] [ERR] Something broke';
    const result = matchLineIOS(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('error');
  });

  it('should map WARN level in IOS_A format', () => {
    const line = '[2019-01-30 T08:29:56.123456 -05:00] [WARN] Watch out';
    const result = matchLineIOS(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('warn');
  });

  it('should match IOS_B format (localized)', () => {
    const line = '[01/30/19, 08:29:56] [INFO] Some iOS log message';
    const result = matchLineIOS(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('info');
    expect(result!.momentValue).toEqual(expect.any(Number));
    expect(Number.isNaN(result!.momentValue)).toBe(false);
  });

  it('should map ERR level in IOS_B format', () => {
    const line = '[01/30/19, 08:29:56] [ERR] Error in iOS';
    const result = matchLineIOS(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('error');
  });
});

describe('matchLineAndroid', () => {
  it('should match ANDROID_C format (full ISO-like timestamp)', () => {
    const line = '2019-01-30 T08:29:56.123456 -5:00 Some Android message';
    const result = matchLineAndroid(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('info');
    expect(result!.message).toBe('Some Android message');
    expect(result!.momentValue).toEqual(expect.any(Number));
    expect(Number.isNaN(result!.momentValue)).toBe(false);
  });

  it('should match ANDROID_A format (MM-DD timestamp)', () => {
    const line = '01-30 08:29:56:123 Some log message from Android';
    const result = matchLineAndroid(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('info');
    expect(result!.message).toBe('Some log message from Android');
    expect(result!.momentValue).toEqual(expect.any(Number));
    expect(Number.isNaN(result!.momentValue)).toBe(false);
  });

  it('should match ANDROID_B format (Mon-DD timestamp in middle)', () => {
    const line = 'some prefix Jan-30 08:29:56.123 actual message';
    const result = matchLineAndroid(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('info');
    expect(result!.message).toContain('actual message');
    expect(result!.momentValue).toEqual(expect.any(Number));
    expect(Number.isNaN(result!.momentValue)).toBe(false);
  });
});

describe('matchLineMobile', () => {
  it('should match MOBILE_RGX format', () => {
    const line =
      '[2019-01-30 T08:29:56.123456 -05:00] ERR Something went wrong';
    const result = matchLineMobile(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('error');
    expect(result!.message).toContain('ERR Something went wrong');
  });

  it('should detect DEBUG level', () => {
    const line = '[2019-01-30 T08:29:56.123456 -05:00] DEBUG Verbose output';
    const result = matchLineMobile(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('debug');
  });

  it('should fall back to iOS matcher', () => {
    const line =
      '[2019-01-30 T08:29:56.123456 -05:00] [INFO] iOS formatted line';
    const result = matchLineMobile(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('info');
  });

  it('should fall back to Android matcher', () => {
    const line = '01-30 08:29:56:123 Android formatted line';
    const result = matchLineMobile(line);

    expect(result).toBeDefined();
    expect(result!.message).toBe('Android formatted line');
  });
});

describe('matchLineSquirrel', () => {
  it('should match a Squirrel installer line', () => {
    const line =
      '2019-01-30 21:08:25> Program: Starting install, writing to C:\\Users\\felix';
    const result = matchLineSquirrel(line);

    expect(result).toBeDefined();
    expect(result!.timestamp).toBe('2019-01-30 21:08:25');
    expect(result!.level).toBe('info');
    expect(result!.message).toContain('Program: Starting install');
    // No TZ passed → Date.UTC(2019, 0, 30, 21, 8, 25, 0)
    expect(result!.momentValue).toBe(Date.UTC(2019, 0, 30, 21, 8, 25, 0));
  });

  it('should skip stack trace lines starting with "   at"', () => {
    const line = '   at System.IO.File.WriteAllBytes(String path)';
    expect(matchLineSquirrel(line)).toBeUndefined();
  });

  it('should return undefined for non-matching lines', () => {
    const line = 'Some random text without timestamp';
    expect(matchLineSquirrel(line)).toBeUndefined();
  });
});

describe('matchLineShipItMac', () => {
  it('should match a ShipIt log line', () => {
    const line =
      '2019-01-08 08:29:56.504 ShipIt[4680:172321] Beginning installation';
    const result = matchLineShipItMac(line);

    expect(result).toBeDefined();
    expect(result!.timestamp).toBe('2019-01-08 08:29:56.504');
    expect(result!.level).toBe('info');
    // No TZ passed → Date.UTC(2019, 0, 8, 8, 29, 56, 504)
    expect(result!.momentValue).toBe(Date.UTC(2019, 0, 8, 8, 29, 56, 504));
  });

  it('should split inline meta at comma-space', () => {
    const line = '2019-01-08 08:29:56.504 Install, source=/tmp/app version=4.0';
    const result = matchLineShipItMac(line);

    expect(result).toBeDefined();
    expect(result!.message).toBe('Install');
    expect(result!.toParseHead).toContain('source=/tmp/app');
  });

  it('should skip lines not starting with a digit', () => {
    const line = 'ShipIt is starting up';
    expect(matchLineShipItMac(line)).toBeUndefined();
  });
});

describe('matchLineChromium', () => {
  it('should match a Chromium debug log line', () => {
    const line =
      '[70491:0302/160742.806:WARNING:gpu_process_host.cc(1303)] The GPU process has crashed';
    const result = matchLineChromium(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('warn');
    expect(result!.message).toBe('The GPU process has crashed');
    // Chromium uses current year; if the resulting date is in the future, year is decremented
    const now = new Date();
    let expectedYear = now.getFullYear();
    if (Date.UTC(expectedYear, 2, 2, 16, 7, 42, 806) > now.valueOf()) {
      expectedYear -= 1;
    }
    expect(result!.momentValue).toBe(
      Date.UTC(expectedYear, 2, 2, 16, 7, 42, 806),
    );
    expect(result!.meta).toMatchObject({
      sourceFile: 'gpu_process_host.cc',
      pid: '70491',
    });
  });

  it('should map INFO level', () => {
    const line = '[12345:0115/093000.100:INFO:some_file.cc(42)] Info message';
    const result = matchLineChromium(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('info');
  });

  it('should map ERROR level', () => {
    const line = '[12345:0115/093000.100:ERROR:some_file.cc(42)] Error message';
    const result = matchLineChromium(line);

    expect(result).toBeDefined();
    expect(result!.level).toBe('error');
  });

  it('should return undefined for non-matching lines', () => {
    expect(matchLineChromium('random text')).toBeUndefined();
  });
});

describe('getMatchFunction', () => {
  const makeFile = (fileName: string): UnzippedFile => ({
    type: 'UnzippedFile',
    id: '1',
    fileName,
    fullPath: `/mock/${fileName}`,
    size: 0,
  });

  it('should return matchLineConsole for app.slack files typed as WEBAPP', () => {
    const fn = getMatchFunction(
      LogType.WEBAPP,
      makeFile('app.slack-desktop.log'),
    );
    expect(fn).toBe(matchLineConsole);
  });

  it('should return matchLineConsole for console files typed as WEBAPP', () => {
    const fn = getMatchFunction(
      LogType.WEBAPP,
      makeFile('console-export-2021.log'),
    );
    expect(fn).toBe(matchLineConsole);
  });

  it('should return matchLineWebApp for other WEBAPP files', () => {
    const fn = getMatchFunction(LogType.WEBAPP, makeFile('webapp-4.log'));
    expect(fn).toBe(matchLineWebApp);
  });

  it('should return matchLineSquirrel for Squirrel installer files', () => {
    const fn = getMatchFunction(
      LogType.INSTALLER,
      makeFile('SquirrelSetup.log'),
    );
    expect(fn).toBe(matchLineSquirrel);
  });

  it('should return matchLineShipItMac for non-Squirrel installer files', () => {
    const fn = getMatchFunction(LogType.INSTALLER, makeFile('ShipIt.log'));
    expect(fn).toBe(matchLineShipItMac);
  });

  it('should return matchLineMobile for MOBILE type', () => {
    const fn = getMatchFunction(
      LogType.MOBILE,
      makeFile('Default_something.log'),
    );
    expect(fn).toBe(matchLineMobile);
  });

  it('should return matchLineChromium for CHROMIUM type', () => {
    const fn = getMatchFunction(
      LogType.CHROMIUM,
      makeFile('electron_debug.log'),
    );
    expect(fn).toBe(matchLineChromium);
  });

  it('should default to matchLineElectron for BROWSER type', () => {
    const fn = getMatchFunction(LogType.BROWSER, makeFile('browser.log'));
    expect(fn).toBe(matchLineElectron);
  });
});

describe('readLogFile (edge cases)', () => {
  it('should collapse repeated consecutive lines', async () => {
    const file: UnzippedFile = {
      type: 'UnzippedFile',
      id: '123',
      fullPath: path.join(__dirname, '../static/browser-repeated.log'),
      fileName: 'browser.log',
      size: 0,
    };

    const { entries } = await readLogFile(file, { logType: LogType.BROWSER });

    expect(entries).toHaveLength(2);
    expect(entries[0].message).toContain('Repeated message');
    expect(entries[0].repeated).toHaveLength(1);
    expect(entries[1].message).toContain('Different message');
    expect(entries[1].repeated).toBeUndefined();
  });

  it('should accumulate multi-line meta from unmatched lines', async () => {
    const file: UnzippedFile = {
      type: 'UnzippedFile',
      id: '123',
      fullPath: path.join(__dirname, '../static/browser-meta.log'),
      fileName: 'browser.log',
      size: 0,
    };

    const { entries } = await readLogFile(file, { logType: LogType.BROWSER });

    expect(entries).toHaveLength(2);
    expect(entries[0].message).toContain('Starting app');
    expect(entries[0].meta).toBeDefined();
    expect(entries[0].meta).toContain('"isDevMode": true');
    expect(entries[0].meta).toContain('"platform": "darwin"');
    expect(entries[1].message).toContain('App ready');
  });

  it('should track level counts correctly', async () => {
    const file: UnzippedFile = {
      type: 'UnzippedFile',
      id: '123',
      fullPath: path.join(__dirname, '../static/browser.log'),
      fileName: 'browser.log',
      size: 1713,
    };

    const { levelCounts } = await readLogFile(file, {
      logType: LogType.BROWSER,
    });

    const totalFromCounts = Object.values(levelCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(totalFromCounts).toBe(13);
  });

  it('should track repeated counts', async () => {
    const file: UnzippedFile = {
      type: 'UnzippedFile',
      id: '123',
      fullPath: path.join(__dirname, '../static/browser-repeated.log'),
      fileName: 'browser.log',
      size: 0,
    };

    const { repeatedCounts } = await readLogFile(file, {
      logType: LogType.BROWSER,
    });

    const totalRepeated = Object.values(repeatedCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(totalRepeated).toBe(1);
  });

  it('should skip empty lines', async () => {
    const file: UnzippedFile = {
      type: 'UnzippedFile',
      id: '123',
      fullPath: path.join(__dirname, '../static/browser.log'),
      fileName: 'browser.log',
      size: 1713,
    };

    const { entries, lines } = await readLogFile(file, {
      logType: LogType.BROWSER,
    });

    // lines counts all lines including empty ones, entries only has parsed entries
    expect(lines).toBeGreaterThanOrEqual(entries.length);
  });
});
