import debug from 'debug';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { UnzippedFile, UnzippedFiles } from '../../interfaces';
import { Unzipper } from '../unzip';
import { isCacheDir } from '../../utils/is-cache';
import { shouldIgnoreFile } from '../../utils/should-ignore-file';

const d = debug('sleuth:filesystem');

/**
 * Takes a rando string, quickly checks if it's a zip or not,
 * and either tries to open it as a file or as a folder. If
 * it's neither, we'll do nothing.
 */
export async function openFile(url: string): Promise<UnzippedFiles | void> {
  d(`Received open-url for ${url}`);
  const stats = fs.statSync(url);
  const isZipFile = /[\s\S]*\.zip$/.test(url);

  let openFunction: (url: string) => Promise<UnzippedFiles>;

  if (isZipFile) {
    openFunction = openZip;
  } else if (stats.isDirectory()) {
    openFunction = openDirectory;
  } else if (stats.isFile()) {
    openFunction = openSingleFile;
  } else {
    return;
  }

  d(`Adding ${url} to recent documents`);
  app.addRecentDocument(url);

  return await openFunction(url);
}

async function openZip(url: string): Promise<UnzippedFiles> {
  const unzipper = new Unzipper(url);
  await unzipper.open();

  return await unzipper.unzip();
}

async function openDirectory(url: string): Promise<UnzippedFiles> {
  d(`Now opening directory ${url}`);

  const dir = await fs.promises.readdir(url);
  const unzippedFiles: UnzippedFiles = [];

  console.groupCollapsed(`Open directory`);

  if (isCacheDir(dir)) {
    console.log(`${url} is a cache directory`);
    this.sleuthState.cachePath = url;
    this.setState({ openEmpty: true });
  } else {
    // Not a cache?
    for (const fileName of dir) {
      if (!shouldIgnoreFile(fileName)) {
        const fullPath = path.join(url, fileName);
        const stats = fs.statSync(fullPath);
        const file: UnzippedFile = {
          fileName,
          fullPath,
          size: stats.size,
          id: fullPath,
          type: 'UnzippedFile',
        };

        d('Found file, adding to result.', file);
        unzippedFiles.push(file);
      }
    }
  }

  console.groupEnd();
  return unzippedFiles;
}

/**
 * We were handed a single log file. We'll pretend it's an imaginary folder
 * with a single file in it.
 */
async function openSingleFile(url: string): Promise<UnzippedFiles> {
  d(`Now opening single file ${url}`);
  console.groupCollapsed(`Open single file`);

  const stats = fs.statSync(url);
  const file: UnzippedFile = {
    fileName: path.basename(url),
    fullPath: url,
    size: stats.size,
    id: url,
    type: 'UnzippedFile',
  };

  console.groupEnd();
  return [file];
}
