import { describe, it, expect } from 'vitest';

import { mergeLogFiles } from '../../src/renderer/processor';

import { LogType, LogLevel, ProcessedLogFile } from '../../src/interfaces';
import {
  mockBrowserFile1,
  mockBrowserFile2,
} from '../../__mocks__/processed-log-file';

describe('mergeLogFiles', () => {
  it('should merge two logfiles together', () => {
    const files = [mockBrowserFile1, mockBrowserFile2];

    return mergeLogFiles(files, LogType.BROWSER).then((result) => {
      expect(result.type).toBe('MergedLogFile');
      expect(result.logEntries).toHaveLength(6);

      const indices = result.logEntries.map((entry) => entry.index);
      expect(indices).toEqual([0, 1, 0, 2, 1, 2]);
    });
  });

  it('should shortcut for a single file', () => {
    return mergeLogFiles([mockBrowserFile1], LogType.BROWSER).then((result) => {
      expect(result.type).toBe('MergedLogFile');
      expect(result.logEntries).toBe(mockBrowserFile1.logEntries);
      expect(result.logFiles).toEqual([mockBrowserFile1]);
    });
  });

  it('should handle entries with missing momentValue', () => {
    const fileWithMissingMoment: ProcessedLogFile = {
      id: 'missing-moment',
      repeatedCounts: {},
      logEntries: [
        {
          index: 0,
          level: LogLevel.info,
          logType: LogType.BROWSER,
          message: 'No timestamp',
          momentValue: 0,
          timestamp: '',
          line: 0,
          sourceFile: 'test-file',
        },
        {
          index: 1,
          level: LogLevel.info,
          logType: LogType.BROWSER,
          message: 'Has timestamp',
          momentValue: 1488837185497,
          timestamp: '2017-03-06T13:53:05.497',
          line: 1,
          sourceFile: 'test-file',
        },
      ],
      logFile: {
        id: 'missing-moment',
        type: 'UnzippedFile',
        fileName: 'browser.log',
        fullPath: '/mock/path/browser.log',
        size: 100,
      },
      logType: LogType.BROWSER,
      type: 'ProcessedLogFile',
      levelCounts: {},
    };

    return mergeLogFiles(
      [fileWithMissingMoment, mockBrowserFile1],
      LogType.BROWSER,
    ).then((result) => {
      expect(result.type).toBe('MergedLogFile');
      expect(result.logEntries).toHaveLength(5);
    });
  });

  it('should produce a stable id from merged files', () => {
    const files = [mockBrowserFile1, mockBrowserFile2];

    return mergeLogFiles(files, LogType.BROWSER).then((result) => {
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });
  });
});
