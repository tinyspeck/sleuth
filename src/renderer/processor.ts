import { getTypeForFile } from '../utils/get-file-types';
import { LogEntry, LogType, UnzippedFile, UnzippedFiles } from '../interfaces';

import { MergedLogFile, SelectableLogType } from '../interfaces';

import { ProcessedLogFile } from '../interfaces';
import { getIdForLogFiles } from '../utils/id-for-logfiles';
import { logPerformance } from './processor/performance';
import { ipcRenderer } from 'electron';
import { IpcEvents } from '../ipc-events';

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
  progressCb?: (status: string) => void,
) {
  const promises: Promise<ProcessedLogFile>[] = [];
  const rawFiles: UnzippedFile[] = [];

  files.forEach((logFile) => {
    if (getShouldProcessFile(logFile)) {
      promises.push(processLogFile(logFile, progressCb));
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
    await ipcRenderer.invoke(IpcEvents.READ_FILE, logFile, logType);
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
 * Sort an array, but do it on a different thread
 */
export function sortWithWebWorker(
  data: unknown[],
  sortFn: string,
): Promise<LogEntry[]> {
  return new Promise((resolve) => {
    // For test cases only
    if (!window.Worker) {
      const sortedData = data.sort(
        new Function(`return ${sortFn}`)(),
      ) as Array<LogEntry>;
      resolve(sortedData);
      return;
    }

    const code = `onmessage = function (evt) {evt.data.sort(${sortFn}); postMessage(evt.data)}`;
    const worker = new Worker(URL.createObjectURL(new Blob([code])));

    worker.onmessage = (data: MessageEvent) => resolve(data.data);
    worker.postMessage(data);
  });
}

/**
 * Takes a bunch of processed log files and merges all the entries into one sorted
 * array.
 *
 * @param {ProcessedLogFiles} logFiles
 */
export function mergeLogFiles(
  logFiles: Array<ProcessedLogFile> | Array<MergedLogFile>,
  logType: SelectableLogType,
): Promise<MergedLogFile> {
  return new Promise((resolve) => {
    let logEntries: Array<LogEntry> = [];
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

      return resolve(singleResult);
    }

    // Alright, let's do this
    (logFiles as Array<ProcessedLogFile>).forEach((logFile) => {
      logEntries = logEntries.concat(logFile.logEntries);
    });

    const sortFn = `function sort(a, b) {
      if (a.momentValue && b.momentValue) {
        return a.momentValue - b.momentValue;
      } else {
        return 1;
      }
    }`;

    sortWithWebWorker(logEntries, sortFn).then((sortedLogEntries) => {
      const multiResult: MergedLogFile = {
        logFiles: logFiles as Array<ProcessedLogFile>,
        logEntries: sortedLogEntries,
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

      resolve(multiResult);
    });
  });
}
