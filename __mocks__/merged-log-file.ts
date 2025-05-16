import { MergedLogFile, LogType } from '../../src/interfaces';

export const fakeMergedFile: MergedLogFile = {
  id: '123',
  logEntries: [],
  logFiles: [],
  logType: LogType.BROWSER,
  type: 'MergedLogFile',
};
