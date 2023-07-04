import { LogType, UnzippedFile, UnzippedFiles } from '../../src/interfaces';
import {
  getTypeForFile,
  getTypesForFiles,
  makeLogEntry,
  matchLineElectron,
  matchLineWebApp,
  mergeLogFiles,
  processLogFile,
  readFile
} from '../../src/renderer/processor';
import { mockBrowserFile1, mockBrowserFile2 } from '../__mocks__/processed-log-file';

import dirtyJSON from 'jsonic';
import path from 'path';

describe('matchLineWebApp', () => {
  it('should match a classic webapp line', () => {
    const line = 'info: 2017/2/22 16:02:37.178 didStartLoading TSSSB.timeout_tim set for ms:60000';
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
      size: 1713
    };

    return readFile(file, LogType.BROWSER).then(({ entries }) => {
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
      size: 1713
    };

    return readFile(file, LogType.WEBAPP).then(({ entries }) => {
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
      momentValue: 1
    };

    const result = makeLogEntry(options, 'browser', 1, 'test-file');
    expect(result).toMatchObject({
      message: '',
      timestamp: '1'
    });
  });
});

describe('processLogFile', () => {
  it('should process a browser.log log file correctly', () => {
    const file: UnzippedFile = {
      type: 'UnzippedFile',
      id: '123',
      fullPath: path.join(__dirname, '../static/browser.log'),
      fileName: 'browser.log',
      size: 1713
    };

    return processLogFile(file).then((result) => {
      expect(result).toMatchObject({
        logEntries: expect.arrayContaining([expect.objectContaining({
          timestamp: '02/22/17, 16:02:32:675',
          level: 'info',
          momentValue: expect.any(Number),
          logType: LogType.BROWSER,
          index: 0,
        })])
      });
    });
  });
});

describe('getTypesForFiles', () => {
  it('should read an array of log files and return a sorting', () => {
    const files = [{
      fileName: 'browser.log',
      fullPath: '_',
      size: 0
    }, {
      fileName: 'renderer-1.log',
      fullPath: '_',
      size: 0
    }, {
      fileName: 'renderer-2.log',
      fullPath: '_',
      size: 0
    }, {
      fileName: 'webapp.log',
      fullPath: '_',
      size: 0
    }, {
      fileName: 'renderer-webapp-123-preload.log',
      fullPath: '_',
      size: 0
    }, {
      fileName: 'slack-teams.log',
      fullPath: '_',
      size: 0
    }, {
      fileName: 'gpu-log.html',
      fullPath: '_',
      size: 0
    }, {
      fileName: 'notification-warnings.json',
      fullPath: '_',
      size: 0
    }];

    const result = getTypesForFiles(files as UnzippedFiles);
    expect(result.browser).toHaveLength(1);
    expect(result.renderer).toHaveLength(2);
    expect(result.webapp).toHaveLength(1);
    expect(result.preload).toHaveLength(1);
    expect(result.state).toHaveLength(3);
  });
});

describe('getTypeForFile', () => {
  const base = {
    type: 'UnzippedFile' as const,
    id: '123',
  };
  it('should get the type for browser log files', () => {
    expect(getTypeForFile({ ...base, fileName: 'browser.log', fullPath: '_', size: 0 })).toEqual('browser');
  });

  it('should get the type for renderer log files', () => {
    expect(getTypeForFile({ ...base, fileName: 'renderer-12.log', fullPath: '_', size: 0 })).toEqual('renderer');
  });

  it('should get the type for webapp log files', () => {
    expect(getTypeForFile({ ...base, fileName: 'webapp-4.log', fullPath: '_', size: 0 })).toEqual('webapp');
  });

  it('should get the type for preload log files', () => {
    expect(getTypeForFile({ ...base, fileName: 'renderer-webapp-44-preload.log', fullPath: '_', size: 0 })).toEqual('preload');
  });
});

describe('mergeLogFiles', () => {
  it('should merge two logfiles together', () => {
    const files = [ mockBrowserFile1, mockBrowserFile2 ];

    return mergeLogFiles(files, LogType.BROWSER).then((result) => {
      expect(result.type).toBe('MergedLogFile');
      expect(result.logEntries).toHaveLength(6);

      const indices = result.logEntries.map((entry) => entry.index);
      expect(indices).toEqual([0, 1, 0, 2, 1, 2]);
    });
  });
});
