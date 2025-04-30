import {
  LogType,
  SortedUnzippedFiles,
  UnzippedFile,
  UnzippedFiles,
} from '../interfaces';

import debug from 'debug';

const d = debug('sleuth:file-types');

/**
 * Takes a bunch of unzipped log files and returns a neatly sorted object.
 *
 * @param {UnzippedFiles} logFiles
 * @returns {SortedUnzippedFiles}
 */
export function getTypesForFiles(logFiles: UnzippedFiles): SortedUnzippedFiles {
  const result: SortedUnzippedFiles = {
    browser: [],
    webapp: [],
    state: [],
    installer: [],
    netlog: [],
    trace: [],
    mobile: [],
    chromium: [],
  };

  logFiles.forEach((logFile) => {
    const logType = getTypeForFile(logFile);

    if (logType === LogType.UNKNOWN) {
      d(
        `File ${logFile.fileName} seems weird - we don't recognize it. Throwing it away.`,
      );
    } else if (result[logType]) {
      result[logType].push(logFile);
    }
  });

  return result;
}

/**
 * Takes a logfile and returns the file's type (browser/webapp/mobile).
 *
 * @param {UnzippedFile} logFile
 * @returns {LogType}
 */
export function getTypeForFile(
  logFile: UnzippedFile,
): Exclude<LogType, LogType.ALL> {
  const fileName = logFile.fileName.split('/').pop() || '';

  if (fileName.endsWith('.trace')) {
    return LogType.TRACE;
  } else if (
    fileName.startsWith('browser') ||
    fileName === 'epics-browser.log'
  ) {
    return LogType.BROWSER;
  } else if (
    fileName.startsWith('webapp') ||
    fileName.startsWith('app.slack') ||
    fileName.startsWith('console') ||
    fileName.startsWith('unknown')
  ) {
    return LogType.WEBAPP;
  } else if (
    (fileName.startsWith('net') &&
      !fileName.includes('net-log-window-console')) ||
    fileName.startsWith('slackNetlog')
  ) {
    return LogType.NETLOG;
  } else if (
    fileName.startsWith('ShipIt') ||
    fileName.includes('SquirrelSetup')
  ) {
    return LogType.INSTALLER;
  } else if (
    fileName.startsWith('Default_') ||
    fileName.startsWith('attachment') ||
    fileName.startsWith('MainAppLog') ||
    fileName.startsWith('NotificationExtension') ||
    fileName.startsWith('ShareExtension') ||
    fileName.startsWith('WidgetLog') ||
    /\w{9,}_\w{9,}_\d{16,}\.txt/.test(fileName)
  ) {
    return LogType.MOBILE;
  } else if (fileName.startsWith('electron_debug')) {
    return LogType.CHROMIUM;
  } else if (
    /^slack-[\s\S]*$/.test(fileName) ||
    fileName.endsWith('.html') ||
    fileName.endsWith('.json') ||
    fileName === 'installation'
  ) {
    return LogType.STATE;
  }

  return LogType.UNKNOWN;
}
