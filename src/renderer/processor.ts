import { getTypeForFile } from '../utils/get-file-types';
import { LogEntry, LogType, UnzippedFile, UnzippedFiles } from '../interfaces';

import { MergedLogFile, SelectableLogType } from '../interfaces';

import { ProcessedLogFile } from '../interfaces';
import { getIdForLogFiles } from '../utils/id-for-logfiles';
import { logPerformance } from './processor/performance';

/**
 * Checks the filename to see if we should process a log file.
 * Does not check if we shouldn't process the whole log type,
 * this is currently only used for those log categories that
 * contain _some_ files that shouldn't be processed (installer).
 *
 * @param {UnzippedFile} logFile
 * @returns {boolean}
 */
function getShouldProcessFile(logFile: UnzippedFile): boolean {
  const name =
    logFile && logFile.fileName ? logFile.fileName.toLowerCase() : '';

  if (name.includes('shipit') && name.endsWith('plist')) {
    return false;
  }

  return true;
}

/**
 * Processes an array of unzipped logfiles.
 */
export async function processLogFiles(
  files: UnzippedFiles,
  userTZ?: string,
  progressCb?: (status: string) => void,
) {
  const promises: Promise<ProcessedLogFile>[] = [];
  const rawFiles: UnzippedFile[] = [];

  files.forEach((logFile) => {
    if (getShouldProcessFile(logFile)) {
      promises.push(processLogFile(logFile, userTZ, progressCb));
    } else {
      rawFiles.push(logFile);
    }
  });

  const processedAndRawFiles = [...rawFiles, ...(await Promise.all(promises))];

  return processedAndRawFiles;
}

/**
 * Processes a single log file.
 *
 * @param {UnzippedFile} logFile
 * @returns {Promise<ProcessedLogFile>}
 */
export async function processLogFile(
  logFile: UnzippedFile,
  userTZ?: string,
  progressCb?: (status: string) => void,
): Promise<ProcessedLogFile> {
  const logType = getTypeForFile(logFile);

  if (logType === LogType.UNKNOWN) {
    throw new Error(
      `Error, attempting to process unknown log file ${logFile.fullPath}`,
    );
  }

  if (progressCb) progressCb(`Processing file ${logFile.fileName}...`);

  const timeStart = performance.now();
  const { entries, lines, levelCounts, repeatedCounts } =
    await window.Sleuth.readLogFile(logFile, logType, userTZ);
  const result: ProcessedLogFile = {
    logFile,
    logEntries: entries,
    logType,
    type: 'ProcessedLogFile',
    levelCounts,
    repeatedCounts,
    id: logFile.fileName,
  };

  logPerformance({
    name: logFile.fileName,
    type: logType,
    lines,
    entries: entries.length,
    processingTime: performance.now() - timeStart,
  });

  return result;
}

/**
 * Merges k sorted arrays into a single sorted array using a linear-scan
 * k-way merge. O(n*k) per step — for the small k typical in log bundles
 * (2-5 files), this outperforms both a heap-based O(n log k) merge (lower
 * constant overhead) and concat+sort O(n log n) (no intermediate copies).
 *
 * Entries with falsy momentValue (0, undefined) are sorted to the end.
 */
function kWayMerge(arrays: Array<LogEntry>[]): Array<LogEntry> {
  const k = arrays.length;
  const pointers = new Array<number>(k).fill(0);
  let totalLength = 0;
  for (let i = 0; i < k; i++) {
    totalLength += arrays[i].length;
  }
  const result = new Array<LogEntry>(totalLength);

  for (let i = 0; i < totalLength; i++) {
    let minIdx = -1;
    let minValue = Infinity;

    for (let j = 0; j < k; j++) {
      if (pointers[j] < arrays[j].length) {
        const value = arrays[j][pointers[j]].momentValue || Infinity;
        if (value < minValue) {
          minValue = value;
          minIdx = j;
        }
      }
    }

    // All remaining entries have falsy momentValue; pick the first available
    if (minIdx === -1) {
      for (let j = 0; j < k; j++) {
        if (pointers[j] < arrays[j].length) {
          minIdx = j;
          break;
        }
      }
    }

    result[i] = arrays[minIdx][pointers[minIdx]];
    pointers[minIdx]++;
  }

  return result;
}

/**
 * Takes a bunch of processed log files and merges all the entries into one sorted
 * array.
 *
 * @param {Array<ProcessedLogFile> | Array<MergedLogFile>} logFiles
 */
export function mergeLogFiles(
  logFiles: Array<ProcessedLogFile> | Array<MergedLogFile>,
  logType: SelectableLogType,
): Promise<MergedLogFile> {
  const start = performance.now();
  const performanceData = {
    type: logType,
    name: `Merged ${logType}`,
  };

  // Single file? Cool, shortcut!
  if (logFiles.length === 1) {
    const singleResult: MergedLogFile = {
      logFiles: logFiles as Array<ProcessedLogFile>,
      logEntries: logFiles[0].logEntries,
      type: 'MergedLogFile',
      logType,
      // The id just needs to be unique
      id: (logFiles as Array<ProcessedLogFile>).map(({ id }) => id).join(','),
    };

    logPerformance({
      ...performanceData,
      entries: singleResult.logEntries.length,
      lines: 0,
      processingTime: performance.now() - start,
    });

    return Promise.resolve(singleResult);
  }

  const arrays = (logFiles as Array<ProcessedLogFile>).map((f) => f.logEntries);
  const logEntries = kWayMerge(arrays);

  const multiResult: MergedLogFile = {
    logFiles: logFiles as Array<ProcessedLogFile>,
    logEntries,
    logType,
    type: 'MergedLogFile',
    id: getIdForLogFiles(logFiles),
  };

  logPerformance({
    ...performanceData,
    entries: multiResult.logEntries.length,
    lines: 0,
    processingTime: performance.now() - start,
  });

  return Promise.resolve(multiResult);
}
