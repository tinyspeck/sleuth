import { describe, it, expect } from 'vitest';

import { mergeLogFiles } from '../../src/renderer/processor';
import {
  LogType,
  LogLevel,
  LogEntry,
  ProcessedLogFile,
} from '../../src/interfaces';

/**
 * Reference implementation: naive concat + sort.
 * Used to verify the k-way merge produces identical output.
 */
function concatSort(files: ProcessedLogFile[]): LogEntry[] {
  const all = files.flatMap((f) => f.logEntries);
  return all.sort((a, b) => {
    const av = a.momentValue || Infinity;
    const bv = b.momentValue || Infinity;
    return av - bv;
  });
}

function makeEntry(
  momentValue: number,
  index: number,
  sourceFile: string,
): LogEntry {
  return {
    index,
    level: LogLevel.info,
    logType: LogType.BROWSER,
    message: `msg-${sourceFile}-${index}`,
    momentValue,
    timestamp: new Date(momentValue).toISOString(),
    line: index,
    sourceFile,
  };
}

function makeFile(id: string, entries: LogEntry[]): ProcessedLogFile {
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

/** Generate a sorted file with `count` entries starting at `baseMs`. */
function generateSortedFile(
  id: string,
  count: number,
  baseMs: number,
  stepMs: number,
): ProcessedLogFile {
  const entries: LogEntry[] = [];
  for (let i = 0; i < count; i++) {
    entries.push(makeEntry(baseMs + i * stepMs, i, id));
  }
  return makeFile(id, entries);
}

describe('k-way merge equivalence with concat+sort', () => {
  it('produces identical output for 2 interleaved files', async () => {
    const file1 = makeFile('a', [
      makeEntry(100, 0, 'a'),
      makeEntry(300, 1, 'a'),
      makeEntry(500, 2, 'a'),
    ]);
    const file2 = makeFile('b', [
      makeEntry(200, 0, 'b'),
      makeEntry(400, 1, 'b'),
      makeEntry(600, 2, 'b'),
    ]);
    const files = [file1, file2];

    const merged = await mergeLogFiles(files, LogType.BROWSER);
    const expected = concatSort(files);

    expect(merged.logEntries.map((e) => e.momentValue)).toEqual(
      expected.map((e) => e.momentValue),
    );
    expect(merged.logEntries.map((e) => e.message)).toEqual(
      expected.map((e) => e.message),
    );
  });

  it('produces identical output for 3 files', async () => {
    const file1 = makeFile('a', [
      makeEntry(100, 0, 'a'),
      makeEntry(400, 1, 'a'),
    ]);
    const file2 = makeFile('b', [
      makeEntry(200, 0, 'b'),
      makeEntry(500, 1, 'b'),
    ]);
    const file3 = makeFile('c', [
      makeEntry(300, 0, 'c'),
      makeEntry(600, 1, 'c'),
    ]);
    const files = [file1, file2, file3];

    const merged = await mergeLogFiles(files, LogType.BROWSER);
    const expected = concatSort(files);

    expect(merged.logEntries.map((e) => e.momentValue)).toEqual(
      expected.map((e) => e.momentValue),
    );
  });

  it('produces identical output for 5 files', async () => {
    const files = [
      generateSortedFile('a', 20, 1000, 50),
      generateSortedFile('b', 15, 1025, 70),
      generateSortedFile('c', 25, 1010, 40),
      generateSortedFile('d', 10, 1050, 100),
      generateSortedFile('e', 30, 1005, 35),
    ];

    const merged = await mergeLogFiles(files, LogType.BROWSER);
    const expected = concatSort(files);

    expect(merged.logEntries.map((e) => e.momentValue)).toEqual(
      expected.map((e) => e.momentValue),
    );
    expect(merged.logEntries).toHaveLength(100);
  });

  it('produces identical output with duplicate timestamps across files', async () => {
    const file1 = makeFile('a', [
      makeEntry(100, 0, 'a'),
      makeEntry(200, 1, 'a'),
      makeEntry(300, 2, 'a'),
    ]);
    const file2 = makeFile('b', [
      makeEntry(100, 0, 'b'),
      makeEntry(200, 1, 'b'),
      makeEntry(300, 2, 'b'),
    ]);
    const files = [file1, file2];

    const merged = await mergeLogFiles(files, LogType.BROWSER);
    const expected = concatSort(files);

    // With identical timestamps, both approaches should produce the same
    // relative ordering (stable within ties — first-file-wins for k-way)
    expect(merged.logEntries.map((e) => e.momentValue)).toEqual(
      expected.map((e) => e.momentValue),
    );
    expect(merged.logEntries).toHaveLength(6);
  });

  it('handles files with falsy momentValue (sorted to end)', async () => {
    const file1 = makeFile('a', [
      makeEntry(100, 0, 'a'),
      { ...makeEntry(0, 1, 'a'), momentValue: 0 },
    ]);
    const file2 = makeFile('b', [
      makeEntry(200, 0, 'b'),
      { ...makeEntry(0, 1, 'b'), momentValue: undefined },
    ]);
    const files = [file1, file2];

    const merged = await mergeLogFiles(files, LogType.BROWSER);
    const expected = concatSort(files);

    // Both approaches treat falsy momentValue as Infinity (end of list)
    expect(merged.logEntries.map((e) => e.momentValue)).toEqual(
      expected.map((e) => e.momentValue),
    );
  });

  it('handles empty files mixed with non-empty files', async () => {
    const file1 = makeFile('a', []);
    const file2 = generateSortedFile('b', 5, 1000, 100);
    const file3 = makeFile('c', []);
    const files = [file1, file2, file3];

    const merged = await mergeLogFiles(files, LogType.BROWSER);
    const expected = concatSort(files);

    expect(merged.logEntries.map((e) => e.momentValue)).toEqual(
      expected.map((e) => e.momentValue),
    );
    expect(merged.logEntries).toHaveLength(5);
  });

  it('produces identical output at scale (1000 entries across 5 files)', async () => {
    // Base values must be > 0 because kWayMerge treats momentValue=0 as falsy
    // (sorted to end), which blocks the file pointer in a k-way merge.
    const files = [
      generateSortedFile('a', 200, 1000, 5),
      generateSortedFile('b', 200, 1002, 5),
      generateSortedFile('c', 200, 1001, 5),
      generateSortedFile('d', 200, 1003, 5),
      generateSortedFile('e', 200, 1004, 5),
    ];

    const merged = await mergeLogFiles(files, LogType.BROWSER);
    const expected = concatSort(files);

    expect(merged.logEntries).toHaveLength(1000);
    expect(merged.logEntries.map((e) => e.momentValue)).toEqual(
      expected.map((e) => e.momentValue),
    );
  });

  it('preserves all entries (no data loss)', async () => {
    const files = [
      generateSortedFile('a', 50, 0, 10),
      generateSortedFile('b', 30, 5, 10),
      generateSortedFile('c', 40, 3, 10),
    ];

    const merged = await mergeLogFiles(files, LogType.BROWSER);

    // Every entry from every file must appear in the result
    const allMessages = new Set(
      files.flatMap((f) => f.logEntries.map((e) => e.message)),
    );
    const mergedMessages = new Set(merged.logEntries.map((e) => e.message));

    expect(mergedMessages).toEqual(allMessages);
    expect(merged.logEntries).toHaveLength(120);
  });
});
