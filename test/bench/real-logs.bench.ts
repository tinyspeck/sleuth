import { bench, describe } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import {
  matchLineElectron,
  matchLineWebApp,
  matchLineConsole,
  readLogFile,
} from '../../src/main/filesystem/read-file';
import { mergeLogFiles } from '../../src/renderer/processor';
import { LogType, UnzippedFile, ProcessedLogFile } from '../../src/interfaces';

// Point SLEUTH_BENCH_LOGS at an extracted Slack log bundle directory.
// Skip these benchmarks when the env var is not set.
const LOGS_DIR = process.env.SLEUTH_BENCH_LOGS ?? '';
const skip = !LOGS_DIR || !fs.existsSync(LOGS_DIR);

function makeFile(fileName: string): UnzippedFile {
  return {
    type: 'UnzippedFile',
    id: fileName,
    fullPath: path.join(LOGS_DIR, fileName),
    fileName,
    size: 0,
  };
}

// --- readLogFile on real files ---

describe.skipIf(skip)('readLogFile - real browser logs', () => {
  const browser = makeFile('browser.log');
  const browser1 = makeFile('browser1.log');
  const browser2 = makeFile('browser2.log');

  bench('browser.log (70K lines)', async () => {
    await readLogFile(browser, { logType: LogType.BROWSER });
  });

  bench('browser1.log (62K lines)', async () => {
    await readLogFile(browser1, { logType: LogType.BROWSER });
  });

  bench('browser2.log (62K lines)', async () => {
    await readLogFile(browser2, { logType: LogType.BROWSER });
  });
});

describe.skipIf(skip)('readLogFile - real webapp console logs', () => {
  const console0 = makeFile('webapp-console.log');
  const console1 = makeFile('webapp-console1.log');

  bench('webapp-console.log (40K lines)', async () => {
    await readLogFile(console0, { logType: LogType.WEBAPP });
  });

  bench('webapp-console1.log (37K lines)', async () => {
    await readLogFile(console1, { logType: LogType.WEBAPP });
  });
});

describe.skipIf(skip)('readLogFile - real epics trace', () => {
  const epics = makeFile('browser-epics-trace.log');

  bench('browser-epics-trace.log (69K lines)', async () => {
    await readLogFile(epics, { logType: LogType.BROWSER });
  });
});

describe.skipIf(skip)('readLogFile - real ShipIt log', () => {
  const shipit = makeFile('ShipIt_stderr.log');

  bench('ShipIt_stderr.log (3.8K lines)', async () => {
    await readLogFile(shipit, { logType: LogType.INSTALLER });
  });
});

// --- mergeLogFiles on real processed files ---

describe.skipIf(skip)(
  'mergeLogFiles - real browser files (3 files, ~196K lines)',
  () => {
    let files: ProcessedLogFile[];

    // Pre-process outside the bench loop
    const setup = (async () => {
      const [f0, f1, f2] = await Promise.all([
        readLogFile(makeFile('browser.log'), { logType: LogType.BROWSER }),
        readLogFile(makeFile('browser1.log'), { logType: LogType.BROWSER }),
        readLogFile(makeFile('browser2.log'), { logType: LogType.BROWSER }),
      ]);
      files = [f0, f1, f2].map((r, i) => ({
        id: `browser${i}`,
        repeatedCounts: r.repeatedCounts,
        logEntries: r.entries,
        logFile: makeFile(`browser${i}.log`),
        logType: LogType.BROWSER,
        type: 'ProcessedLogFile' as const,
        levelCounts: r.levelCounts,
      }));
    })();

    bench(
      'merge 3 browser files',
      async () => {
        await mergeLogFiles(files, LogType.BROWSER);
      },
      {
        setup: async () => {
          await setup;
        },
      },
    );
  },
);

// --- Line matcher throughput on real lines ---

describe.skipIf(skip)('matchLineElectron - real lines throughput', () => {
  let lines: string[];

  const setup = (async () => {
    const content = await fs.readFile(
      path.join(LOGS_DIR, 'browser.log'),
      'utf8',
    );
    lines = content.split('\n');
  })();

  bench(
    'match all lines from browser.log',
    () => {
      for (let i = 0; i < lines.length; i++) {
        matchLineElectron(lines[i]);
      }
    },
    {
      setup: async () => {
        await setup;
      },
    },
  );
});

describe.skipIf(skip)('matchLineConsole - real lines throughput', () => {
  let lines: string[];

  const setup = (async () => {
    const content = await fs.readFile(
      path.join(LOGS_DIR, 'webapp-console.log'),
      'utf8',
    );
    lines = content.split('\n');
  })();

  bench(
    'match all lines from webapp-console.log',
    () => {
      for (let i = 0; i < lines.length; i++) {
        matchLineConsole(lines[i]);
      }
    },
    {
      setup: async () => {
        await setup;
      },
    },
  );
});
