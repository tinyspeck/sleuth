import { describe, it, expect } from 'vitest';

import {
  getTypesForFiles,
  getTypeForFile,
} from '../../src/utils/get-file-types';
import { UnzippedFiles } from '../../src/interfaces';

describe('getTypesForFiles', () => {
  it('should read an array of log files and return a sorting', () => {
    const files = [
      {
        fileName: 'browser.log',
        fullPath: '_',
        size: 0,
      },
      {
        fileName: 'webapp.log',
        fullPath: '_',
        size: 0,
      },
      {
        fileName: 'slack-teams.log',
        fullPath: '_',
        size: 0,
      },
      {
        fileName: 'gpu-log.html',
        fullPath: '_',
        size: 0,
      },
      {
        fileName: 'notification-warnings.json',
        fullPath: '_',
        size: 0,
      },
    ];

    const result = getTypesForFiles(files as UnzippedFiles);
    expect(result.browser).toHaveLength(1);
    expect(result.webapp).toHaveLength(1);
    expect(result.state).toHaveLength(3);
  });
});

describe('getTypeForFile', () => {
  const base = {
    type: 'UnzippedFile' as const,
    id: '123',
  };
  it('should get the type for browser log files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'browser.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('browser');
  });

  it('should get the type for webapp log files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'webapp-4.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('webapp');
  });
});
