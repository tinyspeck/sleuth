import { bench, describe } from 'vitest';
import { mergeLogFiles } from '../../src/renderer/processor';
import {
  LogType,
  LogLevel,
  LogEntry,
  ProcessedLogFile,
} from '../../src/interfaces';
import {
  mockBrowserFile1,
  mockBrowserFile2,
} from '../../__mocks__/processed-log-file';

function generateEntries(count: number, offsetMs = 0): LogEntry[] {
  const baseTime = 1488837185497;
  const entries: LogEntry[] = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      index: i,
      level: LogLevel.info,
      logType: LogType.BROWSER,
      message: `Log message ${i}`,
      momentValue: baseTime + i * 100 + offsetMs,
      timestamp: new Date(baseTime + i * 100 + offsetMs).toISOString(),
      line: i,
      sourceFile: 'bench-file',
    });
  }
  return entries;
}

function makeProcessedFile(id: string, entries: LogEntry[]): ProcessedLogFile {
  return {
    id,
    repeatedCounts: {},
    logEntries: entries,
    logFile: {
      id,
      type: 'UnzippedFile',
      fileName: `${id}.log`,
      fullPath: `/mock/${id}.log`,
      size: 100,
    },
    logType: LogType.BROWSER,
    type: 'ProcessedLogFile',
    levelCounts: {},
  };
}

// --- Small merge (realistic: 2 files, ~3 entries each) ---

describe('mergeLogFiles - small (2 files, 3 entries each)', () => {
  bench('merge', async () => {
    await mergeLogFiles([mockBrowserFile1, mockBrowserFile2], LogType.BROWSER);
  });
});

// --- Single file shortcut ---

describe('mergeLogFiles - single file shortcut', () => {
  bench('merge', async () => {
    await mergeLogFiles([mockBrowserFile1], LogType.BROWSER);
  });
});

// --- Medium merge (2 files, 1K entries each) ---

describe('mergeLogFiles - medium (2 files, 1K entries each)', () => {
  const file1 = makeProcessedFile('medium-1', generateEntries(1_000, 0));
  const file2 = makeProcessedFile('medium-2', generateEntries(1_000, 50));

  bench('merge', async () => {
    await mergeLogFiles([file1, file2], LogType.BROWSER);
  });
});

// --- Large merge (2 files, 10K entries each) ---

describe('mergeLogFiles - large (2 files, 10K entries each)', () => {
  const file1 = makeProcessedFile('large-1', generateEntries(10_000, 0));
  const file2 = makeProcessedFile('large-2', generateEntries(10_000, 50));

  bench('merge', async () => {
    await mergeLogFiles([file1, file2], LogType.BROWSER);
  });
});

// --- Large merge (5 files, 10K entries each) ---

describe('mergeLogFiles - large (5 files, 10K entries each)', () => {
  const files = Array.from({ length: 5 }, (_, i) =>
    makeProcessedFile(`large5-${i}`, generateEntries(10_000, i * 33)),
  );

  bench('merge', async () => {
    await mergeLogFiles(files, LogType.BROWSER);
  });
});

// --- Extra large merge (2 files, 100K entries each) ---

describe('mergeLogFiles - XL (2 files, 100K entries each)', () => {
  const file1 = makeProcessedFile('xl-1', generateEntries(100_000, 0));
  const file2 = makeProcessedFile('xl-2', generateEntries(100_000, 50));

  bench('merge', async () => {
    await mergeLogFiles([file1, file2], LogType.BROWSER);
  });
});

// --- Merge with falsy momentValues ---

describe('mergeLogFiles - with falsy momentValues (1K entries)', () => {
  const entries1 = generateEntries(500, 0);
  const entries2 = generateEntries(500, 50);
  // Sprinkle in some entries with momentValue = 0
  for (let i = 0; i < entries1.length; i += 10) {
    entries1[i].momentValue = 0;
  }

  const file1 = makeProcessedFile('falsy-1', entries1);
  const file2 = makeProcessedFile('falsy-2', entries2);

  bench('merge', async () => {
    await mergeLogFiles([file1, file2], LogType.BROWSER);
  });
});
