import { mockBrowserFile1 } from '../__mocks__/processed-log-file';
import { fakeUnzippedFile } from '../__mocks__/unzipped-file';
import { fakeMergedFile } from '../__mocks__/merged-log-file';
import { isLogFile, isMergedLogFile, isProcessedLogFile, isUnzippedFile } from '../../src/utils/is-logfile';

describe('isMergedLogFile', () => {
  it('should identify a merged log file', () => {
    expect(isMergedLogFile(fakeMergedFile)).toBe(true);
  });

  it('should not identify an unzipped file', () => {
    expect(isMergedLogFile(fakeUnzippedFile)).toBe(false);
  });

  it('should not identify a processed log file', () => {
    expect(isMergedLogFile(mockBrowserFile1)).toBe(false);
  });
});

describe('isProcessedLogFile', () => {
  it('should identify a processed log file', () => {
    expect(isProcessedLogFile(mockBrowserFile1)).toBe(true);
  });

  it('should not identify an unzipped file', () => {
    expect(isProcessedLogFile(fakeUnzippedFile)).toBe(false);
  });

  it('should not identify a merged log file', () => {
    expect(isProcessedLogFile(fakeMergedFile)).toBe(false);
  });
});

describe('isUnzippedFile', () => {
  it('should identify a unzipped log file', () => {
    expect(isUnzippedFile(fakeUnzippedFile)).toBe(true);
  });

  it('should not identify an processed file', () => {
    expect(isUnzippedFile(mockBrowserFile1)).toBe(false);
  });

  it('should not identify a merged log file', () => {
    expect(isUnzippedFile(fakeMergedFile)).toBe(false);
  });
});

describe('isLogFile', () => {
  it('should not identify a unzipped log file', () => {
    expect(isLogFile(fakeUnzippedFile)).toBe(false);
  });

  it('should identify a processed log file', () => {
    expect(isLogFile(mockBrowserFile1)).toBe(true);
  });

  it('should identify a merged log file', () => {
    expect(isLogFile(fakeMergedFile)).toBe(true);
  });
});
