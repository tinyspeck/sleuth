import { bench, describe } from 'vitest';
import path from 'node:path';
import {
  matchLineElectron,
  matchLineWebApp,
  matchLineConsole,
  matchLineIOS,
  matchLineAndroid,
  matchLineMobile,
  matchLineSquirrel,
  matchLineShipItMac,
  matchLineChromium,
  makeLogEntry,
  readLogFile,
} from '../../src/main/filesystem/read-file';
import { LogType, UnzippedFile } from '../../src/interfaces';

// --- Line matcher benchmarks ---

describe('matchLineElectron', () => {
  const line = '[02/22/17, 16:02:33:371] info: Store: UPDATE_SETTINGS';

  bench('single line', () => {
    matchLineElectron(line);
  });

  bench('100 lines', () => {
    for (let i = 0; i < 100; i++) matchLineElectron(line);
  });

  bench('skip non-matching (JSON start)', () => {
    matchLineElectron('{"key": "value"}');
  });
});

describe('matchLineWebApp', () => {
  const desktopLine =
    '[01/12/21, 13:05:05:353] INFO [COUNTS] (T29KZ003T) {"count":5}';
  const webappALine = 'info: Mar-19 13:50:41.676 [FOCUS-EVENT] Window focused';
  const webappBLine =
    'info: 2017/2/22 16:02:37.178 didStartLoading TSSSB.timeout_tim set for ms:60000';

  bench('DESKTOP_RGX format', () => {
    matchLineWebApp(desktopLine);
  });

  bench('WEBAPP_A format', () => {
    matchLineWebApp(webappALine);
  });

  bench('WEBAPP_B format', () => {
    matchLineWebApp(webappBLine);
  });

  bench('skip non-matching (JSON start)', () => {
    matchLineWebApp('{"key": "value"}');
  });
});

describe('matchLineConsole', () => {
  const consoleALine =
    'Sep-24 14:36:07.809 [API-Q] (T34263EUF) conversations.history called';
  const consoleBLine =
    'edgeapi.slack.com/cache/E12KS1G65:1 Failed to load resource: net::ERR_TIMED_OUT';
  const consoleCLine = '11:50:09.731 Exposing workspace desktop delegate';
  const stackTraceLine =
    '    someFunction@https://a.slack-edge.com/file.js:123:45';

  bench('CONSOLE_A format', () => {
    matchLineConsole(consoleALine);
  });

  bench('CONSOLE_B format', () => {
    matchLineConsole(consoleBLine);
  });

  bench('CONSOLE_C format', () => {
    matchLineConsole(consoleCLine);
  });

  bench('skip stack trace', () => {
    matchLineConsole(stackTraceLine);
  });
});

describe('matchLineIOS', () => {
  const iosALine =
    '[2019-01-30 T08:29:56.123456 -05:00] [INFO] Starting application';
  const iosBLine = '[01/30/19, 08:29:56] [INFO] Some iOS log message';

  bench('IOS_A format', () => {
    matchLineIOS(iosALine);
  });

  bench('IOS_B format', () => {
    matchLineIOS(iosBLine);
  });
});

describe('matchLineAndroid', () => {
  const androidALine = '01-30 08:29:56:123 Some log message from Android';
  const androidCLine = '2019-01-30 T08:29:56.123456 -5:00 Some Android message';

  bench('ANDROID_A format', () => {
    matchLineAndroid(androidALine);
  });

  bench('ANDROID_C format', () => {
    matchLineAndroid(androidCLine);
  });
});

describe('matchLineMobile', () => {
  const mobileLine =
    '[2019-01-30 T08:29:56.123456 -05:00] ERR Something went wrong';
  const fallbackLine = '01-30 08:29:56:123 Android formatted line';

  bench('MOBILE_RGX match', () => {
    matchLineMobile(mobileLine);
  });

  bench('fallback to Android', () => {
    matchLineMobile(fallbackLine);
  });
});

describe('matchLineSquirrel', () => {
  const line =
    '2019-01-30 21:08:25> Program: Starting install, writing to C:\\Users\\felix';

  bench('single line', () => {
    matchLineSquirrel(line);
  });
});

describe('matchLineShipItMac', () => {
  const line =
    '2019-01-08 08:29:56.504 ShipIt[4680:172321] Beginning installation';

  bench('single line', () => {
    matchLineShipItMac(line);
  });
});

describe('matchLineChromium', () => {
  const line =
    '[70491:0302/160742.806:WARNING:gpu_process_host.cc(1303)] The GPU process has crashed';

  bench('single line', () => {
    matchLineChromium(line);
  });
});

describe('makeLogEntry', () => {
  const options = {
    timestamp: '02/22/17, 16:02:33:371',
    level: 'info',
    message: 'Store: UPDATE_SETTINGS',
    momentValue: 1488837753371,
  };

  bench('create entry', () => {
    makeLogEntry(options, 'browser', 1, 'test-file');
  });
});

// --- Full file read benchmarks ---

describe('readLogFile', () => {
  const browserFile: UnzippedFile = {
    type: 'UnzippedFile',
    id: 'bench-browser',
    fullPath: path.join(__dirname, '../static/browser.log'),
    fileName: 'browser.log',
    size: 1713,
  };

  const webappFile: UnzippedFile = {
    type: 'UnzippedFile',
    id: 'bench-webapp',
    fullPath: path.join(__dirname, '../static/webapp.log'),
    fileName: 'webapp.log',
    size: 1713,
  };

  bench('browser.log (13 entries)', async () => {
    await readLogFile(browserFile, { logType: LogType.BROWSER });
  });

  bench('webapp.log (4 entries)', async () => {
    await readLogFile(webappFile, { logType: LogType.WEBAPP });
  });
});
