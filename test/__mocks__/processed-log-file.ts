import { ProcessedLogFile, LogType } from '../../src/interfaces';

export const mockBrowserFile1: ProcessedLogFile = {
  id: '123',
  repeatedCounts: {},
  logEntries: [
    {
      index: 0,
      level: 'info',
      logType: LogType.BROWSER,
      message: 'Hi!',
      momentValue: 1488837185497,
      timestamp: '2017-03-06T13:53:05.497',
      line: 0,
      sourceFile: 'test-file'
    }, {
      index: 1,
      level: 'info',
      logType: LogType.BROWSER,
      message: 'Yo!',
      momentValue: 1488837201751,
      timestamp: '2017-03-06T13:53:21.751',
      line: 1,
      sourceFile: 'test-file'
    }, {
      index: 2,
      level: 'info',
      logType: LogType.BROWSER,
      message: 'Hey!',
      momentValue: 1488837270030,
      timestamp: '2017-03-06T13:54:30.030',
      line: 2,
      sourceFile: 'test-file'
    }
  ],
  logFile: {
    id: '123',
    type: 'UnzippedFile',
    fileName: 'browser.log',
    fullPath: '/mock/path/browser.log',
    size: 100
  },
  logType: LogType.BROWSER,
  type: 'ProcessedLogFile',
  levelCounts: {}
};

// Slightly different timestamps
export const mockBrowserFile2: ProcessedLogFile = {
  id: '123',
  repeatedCounts: {},
  logEntries: [
    {
      index: 0,
      level: 'info',
      logType: LogType.BROWSER,
      message: 'Hi!',
      momentValue: 1488837228089,
      timestamp: '2017-03-06T13:53:48.089',
      line: 0,
      sourceFile: 'test-file',
    }, {
      index: 1,
      level: 'info',
      logType: LogType.BROWSER,
      message: 'Yo!',
      momentValue: 1488837285150,
      timestamp: '2017-03-06T13:54:45.150',
      line: 1,
      sourceFile: 'test-file',
    }, {
      index: 2,
      level: 'info',
      logType: LogType.BROWSER,
      message: 'Hey!',
      momentValue: 1488837294254,
      timestamp: '2017-03-06T13:54:54.254',
      line: 2,
      sourceFile: 'test-file',
    }
  ],
  logFile: {
    id: '123',
    type: 'UnzippedFile',
    fileName: 'browser1.log',
    fullPath: '/mock/path/browser1.log',
    size: 100
  },
  logType: LogType.BROWSER,
  type: 'ProcessedLogFile',
  levelCounts: {}
};
