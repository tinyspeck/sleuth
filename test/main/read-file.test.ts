import { LogType } from '../../src/interfaces';

import path from 'path';
import { UnzippedFile } from '../../src/interfaces';
import {
  matchLineElectron,
  matchLineWebApp,
} from '../../src/main/filesystem/read-file';
import { makeLogEntry, readLogFile } from '../../src/main/filesystem/read-file';
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

    return readLogFile(file, LogType.BROWSER).then(({ entries }) => {
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
    });
  });

  it('should read a webapp.log file and create log entries', () => {
    const file: UnzippedFile = {
      type: 'UnzippedFile',
      id: '123',
      fullPath: path.join(__dirname, '../static/webapp.log'),
      fileName: 'webapp.log',
      size: 1713,
    };

    return readLogFile(file, LogType.WEBAPP).then(({ entries }) => {
      expect(entries).toHaveLength(3);
    });
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
