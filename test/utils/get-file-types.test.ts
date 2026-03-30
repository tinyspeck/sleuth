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

  it('should get the type for app.slack console files as webapp', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'app.slack-desktop.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('webapp');
  });

  it('should get the type for console export files as webapp', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'console-export-2021.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('webapp');
  });

  it('should get the type for unknown-prefixed files as webapp', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'unknown-stuff.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('webapp');
  });

  it('should get the type for epics-browser.log as browser', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'epics-browser.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('browser');
  });

  it('should get the type for trace files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'profile.trace',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('trace');
  });

  it('should get the type for netlog files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'netlog-12345.json',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('netlog');
  });

  it('should get the type for slackNetlog files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'slackNetlog.json',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('netlog');
  });

  it('should not categorize net-log-window-console as netlog', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'net-log-window-console.log',
        fullPath: '_',
        size: 0,
      }),
    ).not.toEqual('netlog');
  });

  it('should get the type for ShipIt installer files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'ShipIt.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('installer');
  });

  it('should get the type for SquirrelSetup installer files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'SquirrelSetup.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('installer');
  });

  it('should get the type for Default_ mobile files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'Default_workspace.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('mobile');
  });

  it('should get the type for attachment mobile files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'attachment-log.txt',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('mobile');
  });

  it('should get the type for MainAppLog mobile files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'MainAppLog.txt',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('mobile');
  });

  it('should get the type for NotificationExtension mobile files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'NotificationExtension.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('mobile');
  });

  it('should get the type for ShareExtension mobile files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'ShareExtension.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('mobile');
  });

  it('should get the type for WidgetLog mobile files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'WidgetLog.txt',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('mobile');
  });

  it('should get the type for long-hash mobile files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'ABCDEFGHIJ_KLMNOPQRST_1234567890123456.txt',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('mobile');
  });

  it('should get the type for electron_debug chromium files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'electron_debug.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('chromium');
  });

  it('should get the type for slack- state files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'slack-teams',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('state');
  });

  it('should get the type for .html state files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'gpu-log.html',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('state');
  });

  it('should get the type for .json state files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'log-context.json',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('state');
  });

  it('should get the type for installation state files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'installation',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('state');
  });

  it('should return unknown for unrecognized files', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'randomfile.xyz',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('unknown');
  });

  it('should handle filenames with path separators', () => {
    expect(
      getTypeForFile({
        ...base,
        fileName: 'logs/browser.log',
        fullPath: '_',
        size: 0,
      }),
    ).toEqual('browser');
  });
});
