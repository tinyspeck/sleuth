import { mergeLogFiles } from '../../src/renderer/processor';

import { LogType } from '../../src/interfaces';
import {
  mockBrowserFile1,
  mockBrowserFile2,
} from '../__mocks__/processed-log-file';

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
});
