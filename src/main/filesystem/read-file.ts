import fs from 'fs-extra';
import readline from 'readline';

import { parseJSON } from '../../utils/parse-json';

import {
  LogEntry,
  LogLevel,
  LogType,
  MatchResult,
  UnzippedFile,
} from '../../interfaces';
import { getTypeForFile } from '../../utils/get-file-types';
import debug from 'debug';
import { StateTableState } from '../../renderer/components/state-table';
import { TZDate, tzOffset } from '@date-fns/tz';
import { getEpochFromDateString } from '../../utils/get-timestamp-from-date';

const d = debug('sleuth:read-file');

const DESKTOP_RGX = /^\s*\[([\d/,\s:]{22,24})\] ([A-Za-z]{0,20}):?(.*)$/g;

const WEBAPP_A_RGX = /^(\w*): (.{3}-\d{1,2} \d{2}:\d{2}:\d{2}.\d{0,3}) (.*)$/;
const WEBAPP_B_RGX =
  /^(\w*): (\d{4}\/\d{1,2}\/\d{1,2} \d{2}:\d{2}:\d{2}.\d{0,3}) (.*)$/;

const MOBILE_RGX =
  /^\[([0-9]{4}-[0-9]{2}-[0-9]{2} )T([0-9]{2}:[0-9]{2}:[0-9]{2})(?:.[0-9]{6} -[0-9]{2}:[0-9]{2}\]\s)(.+)/;

const IOS_A_RGX =
  /^\[([0-9]{4}-[0-9]{2}-[0-9]{2})( T)([0-9]{2}:[0-9]{2}:[0-9]{2}).[0-9\s+:\]-]{15}(-|.{0,2}[</[]\w+[>\]])(.*)/;

const IOS_B_RGX =
  /^\s*\[((?:[0-9]{1,4}(?:\/|-|\.|\. )?){3}(?:, | |\){0,2}))((?:上午|下午){0,1}(?:[0-9]{1,2}[:.][0-9]{2}[:.][0-9]{2}\s?(?:AM|PM)?))\] (-|.{0,2}[</[]\w+[>\]])(.+)$/;

const ANDROID_A_RGX =
  /^\s*([0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}:[0-9]{3}) (.+)$/;
const ANDROID_B_RGX =
  /^(?:\u200B|[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3})?\s*(.*)\s*([a-zA-Z]{3}-[0-9]{1,2} [0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3})\s(.*)/;
const ANDROID_C_RGX =
  /^([0-9]{4}-[0-9]{2}-[0-9]{2} )(T)([0-9]{2}:[0-9]{2}:[0-9]{2})(?:.[0-9]{6} -[0-9]{1,2}:[0-9]{2} )(.*)/;

const CONSOLE_A_RGX =
  /(\S*:1)?(?:[\u200B\t ]?)([A-Za-z]{3}-[0-9]{1,2} [0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}) (.+)/g;
const CONSOLE_B_RGX = /^(\S*:1) (.+)/g;
const CONSOLE_C_RGX =
  /^([0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}) (\S*:1)? ?(?:\u200B )?(.+)/g;

// Mar-26 09:29:38.460 []
const WEBAPP_NEW_TIMESTAMP_RGX = /^ ?\w{3}-\d{1,2} \d{1,2}:\d{2}:\d{2}\.\d{3}/g;

// 2019-01-08 08:29:56.504 ShipIt[4680:172321] Beginning installation
const SHIPIT_MAC_RGX = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) (.*)$/;
// 2019-01-30 21:08:25> Program: Starting install, writing to C:\Users\felix\AppData\Local\SquirrelTemp
const SQUIRREL_RGX = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})> (.*)$/;

// [70491:0302/160742.806582:WARNING:gpu_process_host.cc(1303)] The GPU process has crashed 1 time(s)
const CHROMIUM_RGX =
  /^\[(\d+:\d{4}\/\d{6}\.\d{3,6}:[a-zA-Z]+:.*\(\d+\))\] (.*)$/;

function isHtmlFile(file: UnzippedFile) {
  return file.fullPath.endsWith('.html');
}

function isInstallationFile(file: UnzippedFile) {
  return file.fullPath.endsWith('installation');
}

function isExternalConfigFile(file: UnzippedFile) {
  return file.fullPath.endsWith('external-config.json');
}

export async function readStateFile(
  file: UnzippedFile,
): Promise<StateTableState<any> | undefined> {
  if (!file) {
    return;
  }

  d(`Reading ${file.fullPath}`);

  if (isHtmlFile(file)) {
    return { data: undefined, path: file.fullPath };
  } else if (isInstallationFile(file)) {
    try {
      const content = await fs.readFile(file.fullPath, 'utf8');
      return { data: [content], path: undefined };
    } catch (error) {
      d(error);
    }
  } else if (isExternalConfigFile(file)) {
    try {
      const raw = await fs.readFile(file.fullPath, 'utf8');
      const rootStateRaw = await fs.readFile(
        file.fullPath.replace('external-config.json', 'root-state.json'),
        'utf8',
      );
      return {
        data: {
          externalConfig: parseJSON(raw),
          rootState: parseJSON(rootStateRaw),
        },
        path: undefined,
      };
    } catch (error) {
      d(error);
    }
  } else {
    try {
      const raw = await fs.readFile(file.fullPath, 'utf8');
      return { data: parseJSON(raw), path: undefined, raw };
    } catch (error) {
      d(error);
    }
  }
}

/**
 * Reads a log file line by line, creating logEntries in a somewhat smart way.
 */
export function readLogFile(
  logFile: UnzippedFile,
  options: {
    logType?: LogType;
    userTZ?: string;
  },
): Promise<ReadFileResult> {
  return new Promise((resolve) => {
    const entries: Array<LogEntry> = [];
    const readStream = fs.createReadStream(logFile.fullPath);
    const readInterface = readline.createInterface({
      input: readStream,
      terminal: false,
    });
    const parsedlogType = options.logType || getTypeForFile(logFile);
    const matchFn = getMatchFunction(parsedlogType, logFile);

    let lines = 0;
    let current: LogEntry | null = null;
    let toParse = '';

    const levelCounts: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };
    const repeatedCounts: Record<string, number> = {};

    function pushEntry(entry: LogEntry | null) {
      if (entry) {
        // If this a repeated line, save as repeated
        const lastIndex = entries.length - 1;
        const previous = entries.length > 0 ? entries[lastIndex] : null;

        if (
          previous &&
          previous.timestamp &&
          previous.momentValue &&
          entry.timestamp.startsWith('No Date B') &&
          entry.momentValue === 0
        ) {
          // In this case, the line didn't have a timestamp. If possible, give it the timestamp of the line before.
          // This should apply to console log lines (regex B)
          entry.timestamp = previous.timestamp;
          entry.momentValue = previous.momentValue;
        } else if (
          previous &&
          previous.timestamp &&
          previous.momentValue &&
          entry.timestamp.startsWith('No Date C') &&
          entry.momentValue === 0
        ) {
          // In this case, the line has a time but no date. If possible, give it the date of the line before!
          // This should apply to console log lines (regex C) only
          const newTimestamp =
            previous.timestamp.substring(0, 16) + entry.timestamp.substring(9);
          const newDate = new Date(newTimestamp);

          entry.timestamp = newTimestamp;
          entry.momentValue = newDate.valueOf();
        }

        if (
          previous &&
          previous.message === entry.message &&
          previous.meta === entry.meta
        ) {
          entries[lastIndex].repeated = entries[lastIndex].repeated || [];
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          entries[lastIndex].repeated!.push(entry.timestamp);

          repeatedCounts[entry.message] =
            (repeatedCounts[entry.message] || 0) + 1;
        } else {
          entry.index = entries.length;

          if (entry.level) {
            levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
          }

          entries.push(entry);
        }
      }
    }

    function readLine(line: string) {
      lines = lines + 1;
      if (!line || line.length === 0) {
        return;
      }

      const matched = matchFn(line, options.userTZ);

      if (matched) {
        // Is there a meta object?
        if (current && toParse && toParse.length > 0) {
          current.meta = toParse;
        }
        pushEntry(current);

        // Create new entry
        toParse = matched.toParseHead || '';
        current = makeLogEntry(matched, parsedlogType, lines, logFile.fullPath);
      } else {
        // We couldn't match, let's treat it
        if (parsedlogType === 'mobile' && current) {
          // Android logs do too
          current.message += '\n' + line;
        } else if (
          current &&
          (logFile.fileName.startsWith('app.slack') ||
            logFile.fileName.startsWith('console-export-'))
        ) {
          // For console logs which are typed as webapp so we can't just detect using type:
          if (toParse && toParse.length > 0) {
            // If there's already a meta, just add to the meta
            toParse += line + '\n';
          } else if (
            line.includes('@') ||
            line.includes('(async)') ||
            line.match(/Show [\d]+ more frames/)
          ) {
            // This is part of a stack trace - I could add it to the above line but that's a mouthful
            toParse += line + '\n';
          } else {
            current.message += '\n' + line;
          }
        } else {
          // This is (hopefully) part of a meta object
          toParse += line + '\n';
        }
      }
    }

    // Reads each line of the file and runs readLine on it, which goes to pushEntry, then resets itself (creates new current)
    readInterface.on('line', readLine);
    // This happens on the last line of the file because we don't need to create a new current (?)
    readInterface.on('close', () => {
      pushEntry(current);

      resolve({ entries, lines, levelCounts, repeatedCounts });
    });
  });
}

/**
 * Matches a webapp line
 */
export function matchLineWebApp(
  line: string,
  userTZ?: string,
): MatchResult | undefined {
  // Matcher for the webapp, which is a bit dirty. This beast of a regex
  // matches three possible timestamps:
  //
  // info: 2017/2/22 16:02:37.178 didStartLoading called TSSSB.timeout_tim set for ms:60000
  // info: Mar-19 13:50:41.676 [FOCUS-EVENT] Window focused
  // [01/12/2021, 24:13:05:353] INFO [COUNTS] (T29KZ003T)
  //
  // Matcher for webapp logs that don't have a timestamp, but do have a level 🙄
  // info: ╔═══════════════════════════════════════════════════════════════════════╗
  // Sometimes they just log
  // TS.storage.isUsingMemberBotCache():false

  // If the line starts with a `{`, we're taking a shortcut and are expecting data.
  if (line[0] === '{') return;

  DESKTOP_RGX.lastIndex = 0;
  let results = DESKTOP_RGX.exec(line);

  // First, try the expected default format
  if (results && results.length === 4) {
    // Expected format: MM/DD/YY(YY), HH:mm:ss:SSS'
    const dateString = results[1].replace(', 24:', ', 00:');
    const momentValue = getEpochFromDateString(dateString, userTZ);
    let message = results[3];

    // If we have two timestamps, cut that from the message
    WEBAPP_NEW_TIMESTAMP_RGX.lastIndex = 0;
    if (WEBAPP_NEW_TIMESTAMP_RGX.test(results[3])) {
      message = message.slice(WEBAPP_NEW_TIMESTAMP_RGX.lastIndex);
    }

    let meta: string | undefined = undefined;

    // As a shortcut, detect `{` as the start of some JSON and store it into the meta
    const indexOfJSON = message.indexOf('{');
    if (indexOfJSON > -1) {
      meta = message.slice(indexOfJSON);
      message = message.slice(0, indexOfJSON);
    }

    return {
      timestamp: results[1],
      level: results[2].toLowerCase(),
      message,
      momentValue,
      meta,
    };
  }

  // Alright, try WEBAPP_A.
  WEBAPP_A_RGX.lastIndex = 0;
  results = WEBAPP_A_RGX.exec(line);

  if (results && results.length === 4) {
    return {
      timestamp: results[2],
      level: results[1],
      message: results[3],
    };
  }

  // Let's try a different timestamp
  WEBAPP_B_RGX.lastIndex = 0;
  results = WEBAPP_B_RGX.exec(line);

  if (results && results.length === 4) {
    return {
      timestamp: results[2],
      level: results[1],
      message: results[3],
    };
  }

  return;
}

/**
 * Matches a line coming from Squirrel
 */
export function matchLineSquirrel(
  line: string,
  userTZ?: string,
): MatchResult | undefined {
  if (line.startsWith('   at')) return;

  SQUIRREL_RGX.lastIndex = 0;
  const results = SQUIRREL_RGX.exec(line);

  if (results && results.length === 3) {
    // Expected format: 2019-01-30 21:08:25
    const momentValue = getEpochFromDateString(results[1], userTZ);

    return {
      timestamp: results[1],
      level: 'info',
      message: results[2],
      momentValue,
    };
  }

  return;
}

/**
 * Matches a line coming from a ShipIt log file
 */
export function matchLineShipItMac(
  line: string,
  userTZ?: string,
): MatchResult | undefined {
  // If the line does not start with a number, we're taking a shortcut and
  // are expecting data.
  if (!/\d/.test(line[0])) return;

  SHIPIT_MAC_RGX.lastIndex = 0;
  const results = SHIPIT_MAC_RGX.exec(line);

  if (results && results.length === 3) {
    // Expected format: 2019-01-08 08:29:56.504
    const momentValue = getEpochFromDateString(results[1], userTZ);
    let message = results[2];

    // Handle a meta entry
    // ShipIt logs have data on the same line
    const hasMeta = message.indexOf(', ');
    let toParseHead = '';

    if (hasMeta > -1) {
      toParseHead = message.slice(hasMeta + 1) + '\n';
      message = message.slice(0, hasMeta);
    }

    return {
      timestamp: results[1],
      level: 'info',
      message,
      momentValue,
      toParseHead,
    };
  }

  return;
}

/**
 * Matches an Electron line (Browser)
 */
export function matchLineElectron(
  line: string,
  userTZ?: string,
): MatchResult | undefined {
  // If the line starts with a `{`, we're taking a shortcut and are expecting data.
  if (line[0] === '{') return;

  // Matcher for Slack Desktop, 2.6.0 and onwards!
  // [02/22/17, 16:02:33:371] info: Store: UPDATE_SETTINGS
  DESKTOP_RGX.lastIndex = 0;
  const results = DESKTOP_RGX.exec(line);

  if (results && results.length === 4) {
    // Expected format: MM/DD/YY, HH:mm:ss:SSS'
    const dateString = results[1].replace(', 24:', ', 00:');
    const momentValue = getEpochFromDateString(dateString, userTZ);

    return {
      timestamp: results[1],
      level: results[2].toLowerCase(),
      message: results[3],
      momentValue,
    };
  }

  return;
}

/**
 * Matches a console log line (Chrome or Firefox)
 *
 * @param line
 * @returns ({MatchResult | undefined})
 */
export function matchLineConsole(line: string): MatchResult | undefined {
  // This monster recognizes several cases, including but not limited to:
  //
  // CONSOLE_A_RGX:
  //  Sep-24 14:36:07.809 [API-Q] (T34263EUF) e437fee7-1600983367.809
  // (cont.) conversations.history called with reason: message-pane/requestHistory
  // a.slack-edge.com/bv1-8/gantry-shared.75d2ab5.min.js?cacheKey=gantry-1600974368:1
  // (cont.) Sep-24 14:40:32.318 (T34263EUF) Notification (message) suppressed because:
  // 11:50:19.372 service-worker.js:1 Jan-19 11:50:19.372 [SERVICE-WORKER] checking if asset
  // (cont.) is in an existing cache bucket: gantry-1611070538 https://a.slack-edge.com/
  // 11:50:19.377 Jan-19 11:50:19.377 [SERVICE-WORKER] checking if asset is in an existing
  // (cont.) cache bucket: gantry-1611070538 https://a.slack-edge.com/
  //
  // CONSOLE_B_RGX:
  // edgeapi.slack.com/cache/E12KS1G65/T34263EUF/users/info:1 Failed to load resource: net::ERR_TIMED_OUT
  //
  // CONSOLE_C_RGX:
  // 11:50:09.731 Exposing workspace desktop delegate for  {
  // 11:50:10.297 [API-Q] (T34263EUF) noversion-1611085810.297 Flannel users/info is ENQUEUED
  // 11:50:18.322 gantry-shared.f1348ec.min.js?cacheKey=gantry-1611070538:1
  // (cont.) [API-Q] (T34263EUF) noversion-1611085818.279 Flannel users/info is RESOLVED

  if (
    line.includes('@') ||
    line.includes('(async)') ||
    line.match(/Show [\d]+ more frames/)
  ) {
    return;
  }
  // These lines are part of a stack trace, let's skip the regex so we can add them to the meta

  CONSOLE_A_RGX.lastIndex = 0;
  let results = CONSOLE_A_RGX.exec(line);

  if (results && results.length === 4) {
    const currentDate = new Date();
    const newTimestamp = new Date(results[2]);
    newTimestamp.setFullYear(currentDate.getFullYear());

    if (newTimestamp > currentDate) {
      // If the date is in the future, change the year by -1
      newTimestamp.setFullYear(newTimestamp.getFullYear() - 1);
    }

    const momentValue = newTimestamp.valueOf();

    return {
      timestamp: newTimestamp.toString(),
      level: 'info',
      message: results[1] ? results[3] + ' <' + results[1] + '>' : results[3],
      momentValue,
    };
  }

  CONSOLE_B_RGX.lastIndex = 0;
  results = CONSOLE_B_RGX.exec(line);

  if (results && results.length === 3) {
    return {
      // This has no timestamp at all; let's give it 'No Date' so we can identify it later
      timestamp: 'No Date B',
      level: 'info',
      message: results[2] + ' ' + results[1],
      momentValue: 0,
    };
  }

  CONSOLE_C_RGX.lastIndex = 0;
  results = CONSOLE_C_RGX.exec(line);

  if (results && results.length === 4) {
    return {
      // 'No Date' is the default timestamp given to these console logs so we can identify & append new datestamps in pushEntry()
      timestamp: 'No Date C' + results[1],
      level: 'info',
      message: results[2] ? results[3] + ' <' + results[2] + '>' : results[3],
      momentValue: 0,
    };
  }

  return;
}

/**
 * Matches an iOS line
 *
 * @param line
 * @returns {(MatchResult | undefined)}
 */
export function matchLineIOS(line: string): MatchResult | undefined {
  // This iOS regex is for the newest timestamp format (as of 5/5/25)
  IOS_A_RGX.lastIndex = 0;
  let results = IOS_A_RGX.exec(line);
  if (results && results.length === 6) {
    const timestamp = results[1] + ' ' + results[3];
    const momentValue = new Date(timestamp).valueOf();
    const oldLevel = results[4];
    let newLevel;

    if (oldLevel.includes('ERR')) {
      newLevel = 'error';
    } else if (oldLevel.includes('WARN')) {
      newLevel = 'warn';
    } else {
      newLevel = 'info';
    }

    return {
      timestamp,
      level: newLevel,
      message: results[5],
      momentValue,
    };
  }

  // The iOS regex is long because it accounts for the localized versions
  // Android logs are always in English which makes them simpler than iOS
  IOS_B_RGX.lastIndex = 0;
  results = IOS_B_RGX.exec(line);

  if (results && results.length === 5) {
    // Results should be: full match, date, time, level, message
    // If it's dd.mm.yy, replace each with /
    let fixedDate = results[1].replace('.', '/');
    fixedDate = fixedDate.replace('.', '/');
    // Translate AM/PM and fix hh.mm.ss to hh:mm:ss
    let fixedTime = results[2].replace(/上午([\d:]+)/, '$1 AM');
    fixedTime = fixedTime.replace(/下午([\d:]+)/, '$1 PM');
    fixedTime = fixedTime.replace('.', ':');
    fixedTime = fixedTime.replace('.', ':');
    let timestamp = fixedDate + fixedTime;
    // Expected format: MM/DD/YY, HH:mm:ss ?AM|PM'
    let momentValue = new Date(timestamp).valueOf();
    // If DD/MM/YY format, switch the first two parts around to make it MM/DD
    if (!momentValue) {
      const splits = timestamp.split(/\//);
      const rejoinedDate = [splits[1], splits[0], splits[2]].join('/');
      momentValue = new Date(rejoinedDate).valueOf();
      timestamp = rejoinedDate;
    }

    const oldLevel = results[3];
    let newLevel: string;

    if (oldLevel.includes('ERR')) {
      newLevel = 'error';
    } else if (oldLevel.includes('WARN')) {
      newLevel = 'warn';
    } else {
      newLevel = 'info';
    }

    return {
      timestamp,
      level: newLevel,
      message: results[4],
      momentValue,
    };
  }
  return;
}

/**
 * Matches an Android line
 *
 * @param line
 * @returns {(MatchResult | undefined)}
 */
export function matchLineAndroid(line: string): MatchResult | undefined {
  // ANDROID_C_RGX expects lines that start with YYYY-MM-DD THH:MM:SS.SSSSSS
  ANDROID_C_RGX.lastIndex = 0;
  let results = ANDROID_C_RGX.exec(line);

  if (results && results.length === 5 && results[2] === 'T') {
    // We're gonna merge the date and time
    const newTimestamp = new Date(results[1] + results[3]);

    // Expected format: MM-DD HH:mm:ss:sss
    const momentValue = newTimestamp.valueOf();

    return {
      timestamp: newTimestamp.toString(),
      level: 'info',
      message: results[4],
      momentValue,
    };
  }

  // ANDROID_A_RGX expects lines that start with MM-DD HH:mm:ss:sss
  ANDROID_A_RGX.lastIndex = 0;
  results = ANDROID_A_RGX.exec(line);

  if (results && results.length === 3) {
    // Android timestamps have no year, so we gotta add one
    const currentDate = new Date();
    const newTimestamp = new Date(results[1]);
    newTimestamp.setFullYear(currentDate.getFullYear());

    if (newTimestamp > currentDate) {
      // If the date is in the future, change the year by -1
      newTimestamp.setFullYear(newTimestamp.getFullYear() - 1);
    }

    // Expected format: MM-DD HH:mm:ss:sss
    const momentValue = newTimestamp.valueOf();

    return {
      timestamp: newTimestamp.toString(),
      level: 'info',
      message: results[2],
      momentValue,
    };
  }

  // ANDROID_B_RGX expects lines that start with extra info, then MMM-DD HH:mm:ss.sss

  ANDROID_B_RGX.lastIndex = 0;
  results = ANDROID_B_RGX.exec(line);

  if (results && results.length === 4) {
    const currentDate = new Date();
    const newTimestamp = new Date(results[2]);
    newTimestamp.setFullYear(currentDate.getFullYear());

    if (newTimestamp > currentDate) {
      // If the date is in the future, change the year by -1
      newTimestamp.setFullYear(newTimestamp.getFullYear() - 1);
    }

    const momentValue = newTimestamp.valueOf();

    return {
      timestamp: newTimestamp.toString(),
      level: 'info',
      message: results[3] + ' ' + results[1],
      momentValue,
    };
  }

  return;
}

/**
 *
 * @param {string} line
 * @returns  {(MatchResult | undefined)}
 */
export function matchLineMobile(line: string): MatchResult | undefined {
  MOBILE_RGX.lastIndex = 0;
  const results = MOBILE_RGX.exec(line);

  if (results && results.length === 4) {
    const newDate = results[1] + results[2];
    let level = '';
    if (results[3].includes('ERR')) {
      level = 'error';
    } else if (results[3].includes('DEBUG')) {
      level = 'debug';
    } else {
      level = 'info';
    }

    return {
      timestamp: new Date(newDate).toString(),
      level,
      message: results[3],
      momentValue: new Date(newDate).valueOf(),
    };
  } else {
    let old_results = matchLineIOS(line);
    if (!old_results) {
      old_results = matchLineAndroid(line);
    }
    return old_results;
  }
}

export function matchLineChromium(line: string): MatchResult | undefined {
  // See format: https://support.google.com/chrome/a/answer/6271282
  const results = CHROMIUM_RGX.exec(line);

  if (!Array.isArray(results)) {
    return undefined;
  }

  const [, metadata, message] = results;
  const [pid, timestamp, level, sourceFile] = metadata.split(':');
  const currentDate = new Date();

  // ts format is MMDD/HHmmss.SSS
  // this log format has no year information. Assume that the logs
  // happened in the past year because why would we read stale logs?
  const [date, time] = timestamp.split('/');
  const logDate = new Date(
    currentDate.getFullYear(),
    parseInt(date.slice(0, 2), 10) - 1, // month (0-indexed)
    parseInt(date.slice(2, 4), 10), // day
    parseInt(time.slice(0, 2), 10), // hour
    parseInt(time.slice(2, 4), 10), // minute
    parseInt(time.slice(4, 6), 10), // second
    parseInt(time.slice(7, 10), 10), // millisecond
  );

  // make sure we aren't time traveling. Maybe this
  // log happened in the last calendar year?
  if (logDate > currentDate) {
    logDate.setFullYear(logDate.getFullYear() - 1);
  }

  // FIXME: make this more robust for all chromium log levels
  const LEVEL_MAP: Record<string, string> = {
    WARNING: 'warn',
    INFO: 'info',
    ERROR: 'error',
  };

  return {
    level: LEVEL_MAP[level],
    message,
    momentValue: logDate.valueOf(),
    meta: {
      sourceFile: sourceFile.split('(')[0],
      pid,
    },
  };
}

/**
 * Returns the correct match line function for a given log type.
 *
 * @export
 * @param {LogType} logType
 * @param {UnzippedFile} logFile
 * @returns {((line: string) => MatchResult | undefined)}
 */
export function getMatchFunction(
  logType: LogType,
  logFile: UnzippedFile,
): (line: string, userTZ?: string) => MatchResult | undefined {
  if (logType === LogType.WEBAPP) {
    if (
      logFile.fileName.startsWith('app.slack') ||
      logFile.fileName.startsWith('console')
    ) {
      return matchLineConsole;
    } else {
      return matchLineWebApp;
    }
  } else if (logType === LogType.INSTALLER) {
    if (logFile.fileName.includes('Squirrel')) {
      return matchLineSquirrel;
    } else {
      return matchLineShipItMac;
    }
  } else if (logType === LogType.MOBILE) {
    return matchLineMobile;
  } else if (logType === LogType.CHROMIUM) {
    return matchLineChromium;
  } else {
    return matchLineElectron;
  }
}

/**
 * Makes a log entry, ensuring that the required properties exist
 *
 * @export
 * @param {MatchResult} options
 * @param {string} logType
 * @param {number} line
 * @param {string} sourceFile
 * @returns {LogEntry}
 */
export function makeLogEntry(
  options: MatchResult,
  logType: string,
  line: number,
  sourceFile: string,
): LogEntry {
  options.message = options.message || '';
  options.timestamp = options.timestamp || '';
  options.level = options.level || '';

  const logEntry = { ...options, logType, line, sourceFile };
  return logEntry as LogEntry;
}

export interface ReadFileResult {
  entries: Array<LogEntry>;
  lines: number;
  levelCounts: Record<string, number>;
  repeatedCounts: Record<string, number>;
}
