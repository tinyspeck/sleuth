import { shell } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import { formatDistanceToNow } from 'date-fns';
import debug from 'debug';
import yauzl, { Entry, ZipFile } from 'yauzl';

import { Suggestion } from '../interfaces';
import { getPath, showMessageBox } from './ipc';

const d = debug('sleuth:suggestions');

export async function getItemsInSuggestionFolders(): Promise<
  Array<Suggestion>
> {
  const suggestionsArr: Suggestion[] = [];

  // We'll get suggestions from the downloads folder and
  // the desktop
  try {
    try {
      const downloadsDir = await getPath('downloads');
      const downloads = (await fs.readdir(downloadsDir)).map((file) =>
        path.join(downloadsDir, file),
      );
      suggestionsArr.push(...(await getSuggestions(downloads)));
    } catch (e) {
      d(e);
    }

    try {
      const desktopDir = await getPath('desktop');
      const desktop = (await fs.readdir(desktopDir)).map((file) =>
        path.join(desktopDir, file),
      );
      suggestionsArr.push(...(await getSuggestions(desktop)));
    } catch (e) {
      d(e);
    }

    const sortedSuggestions = suggestionsArr.sort((a, b) => {
      return b.mtimeMs - a.mtimeMs;
    });

    return sortedSuggestions;
  } catch (error) {
    d(error);
  }
  return [];
}

export async function deleteSuggestion(filePath: string) {
  const trashName =
    window.Sleuth.platform === 'darwin' ? 'trash' : 'recycle bin';

  const { response } = await showMessageBox({
    title: 'Delete File?',
    message: `Do you want to move ${filePath} to the ${trashName}?`,
    type: 'question',
    buttons: ['Cancel', `Move to ${trashName}`],
    cancelId: 0,
  });

  if (response) {
    await shell.trashItem(filePath);
  }

  return !!response;
}

export async function deleteSuggestions(filePaths: Array<string>) {
  const trashName =
    window.Sleuth.platform === 'darwin' ? 'trash' : 'recycle bin';

  const { response } = await showMessageBox({
    title: 'Delete Files?',
    message: `Do you want to move all log files older than 48 hours to the ${trashName}?`,
    type: 'question',
    buttons: ['Cancel', `Move to ${trashName}`],
    cancelId: 0,
  });

  if (response) {
    await Promise.all(filePaths.map((filePath) => shell.trashItem(filePath)));
  }

  return !!response;
}

function streamToString(zip: ZipFile, entry: Entry): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);

      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  });
}

async function getSuggestionInfo(path: string) {
  if (!path.endsWith('.zip')) {
    const logContent = await fs.readFile(path, 'utf8');
    const firstFewLines = logContent.split('\n', 5);
    const appVersion =
      firstFewLines
        .find((line) => line.startsWith('App Version:'))
        ?.substring(13)
        ?.trim() || '0.0.0';

    if (firstFewLines.some((line) => line.startsWith('Agent:'))) {
      // Android Log
      return {
        platform: 'android',
        appVersion,
        instanceUuid: '',
      };
    } else if (firstFewLines.some((line) => line.startsWith('OS Version:'))) {
      // iOS Log
      return {
        platform: 'ios',
        appVersion,
        instanceUuid: '',
      };
    }

    return {
      platform: 'unknown',
      appVersion: '0.0.0',
      instanceUuid: '',
    };
  }

  const files: Record<string, Promise<string>> = {};

  await new Promise<void>((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.readEntry();
      zipfile.on('entry', (entry: Entry) => {
        if (
          entry.fileName === 'installation' ||
          entry.fileName === 'environment.json'
        ) {
          files[entry.fileName] = streamToString(zipfile, entry);
          files[entry.fileName].then(() => zipfile.readEntry());
        } else {
          zipfile.readEntry();
        }
      });
      zipfile.on('error', (error: Error) => {
        reject(error);
      });
      zipfile.on('end', () => resolve());
    });
  });

  const installation = await files.installation;
  const environment = JSON.parse(await files['environment.json']);

  return {
    platform: environment.platform,
    appVersion: environment.appVersion,
    instanceUuid: Buffer.from(installation, 'base64').toString('utf-8'),
  };
}

/**
 * Takes an array of file paths and checks if they're files we'd like
 * to suggest
 *
 * @param {Array<string>} input
 * @returns {Promise<StringMap<Suggestion>>}
 */
async function getSuggestions(
  input: Array<string>,
): Promise<Array<Suggestion>> {
  const suggestions: Array<Suggestion> = [];

  for (const file of input) {
    d(`Checking ${file}`);
    // If the file is from #alerts-desktop-logs, the server will
    // have named it, not the desktop app itself.
    // It'll look like T8KJ1FXTL_U8KCVGGLR_1580765146766674.zip
    //
    // If the file is from #alerts-ios-logs, the server will h
    // have named it T8KJ1FXTL_U8KCVGGLR_1580765146766674.txt
    const serverFormat = /\w{9,}_\w{9,}_\d{13,}(?:_\d)?\.(zip|txt)/;
    const logsFormat = /.*logs.*\.zip/;
    const iosLogsFormat = /(utf-8'')?Default_(.){0,20}(\.txt$)/;
    const androidLogsFormat = /attachment?.{0,20}.txt/;
    const chromeLogsFormat = /app\.slack\.com-\d{13,}\.log/;
    const firefoxLogsFormat = /console(-export)?[\d\-_]{0,22}\.(txt|log)/;

    const isIosLog = iosLogsFormat.test(file);
    const isAndroidLog = androidLogsFormat.test(file);
    const isWebLog =
      chromeLogsFormat.test(file) || firefoxLogsFormat.test(file);
    const shouldAdd =
      logsFormat.test(file) ||
      serverFormat.test(file) ||
      isIosLog ||
      isWebLog ||
      isAndroidLog;

    if (shouldAdd) {
      const stats = fs.statSync(file);
      const age = formatDistanceToNow(stats.mtimeMs);
      try {
        suggestions.push({
          filePath: file,
          ...stats,
          age,
          ...(isWebLog
            ? {
                platform: 'web',
                appVersion: '0.0.0',
                instanceUuid: '',
              }
            : await getSuggestionInfo(file)),
        });
      } catch (error) {
        suggestions.push({
          filePath: file,
          ...stats,
          age,
          error,
        });
        d(`Tried to add ${file}, but failed: ${error}`);
      }
    }
  }

  return suggestions;
}
