import { fakeUnzippedFile } from '../../__mocks__/unzipped-file';
import {
  ProcessedLogFile,
  ProcessedLogFiles,
  LogType,
} from '../../src/interfaces';
import { getFirstLogFile } from '../../src/utils/get-first-logfile';

const fakeFile: ProcessedLogFile = {
  repeatedCounts: {},
  id: '123',
  logEntries: [],
  logFile: fakeUnzippedFile,
  logType: LogType.BROWSER,
  type: 'ProcessedLogFile',
  levelCounts: {},
};

const files: ProcessedLogFiles = {
  browser: [],
  webapp: [],
  state: [],
  netlog: [],
  installer: [],
  trace: [],
  mobile: [],
  chromium: [],
};

describe('getFirstLogFile', () => {
  afterEach(() => {
    files.browser = [];
    files.webapp = [];
    files.state = [];
  });

  it('should return the first logfile (browser if available)', () => {
    fakeFile.logType = LogType.BROWSER;
    files.browser = [fakeFile];

    expect(getFirstLogFile(files)).toEqual(fakeFile);
  });

  it('should return the first logfile (webapp if available)', () => {
    fakeFile.logType = LogType.WEBAPP;
    files.webapp = [fakeFile];

    expect(getFirstLogFile(files)).toEqual(fakeFile);
  });
});
