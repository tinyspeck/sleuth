import debug from 'debug';
import fs from 'fs-extra';
import tmp from 'tmp';
import yauzl, { Entry, ZipFile } from 'yauzl';

import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

import { shouldIgnoreFile } from '../utils/should-ignore-file';
import { UnzippedFile } from '../interfaces';

const d = debug('sleuth:unzip');

/**
 * Handles unzipping a log archive.
 */
export class Unzipper {
  public readonly url: string;
  public output: string;
  public zipfile: ZipFile;
  public files: Array<UnzippedFile> = [];

  public uniqueFileNameCount: Map<string, number> = new Map();

  constructor(url: string) {
    this.url = url;
    d(`Created new Unzipper with url ${url}`);
  }

  public open() {
    return new Promise<void>((resolve, reject) => {
      yauzl.open(this.url, { lazyEntries: true }, (error, zip) => {
        if (error) {
          return reject(error);
        }

        this.zipfile = zip;
        this.zipfile.on('entry', (entry) => this.handleEntry(entry));
        resolve();
      });
    });
  }

  public unzip(): Promise<Array<UnzippedFile>> {
    return new Promise((resolve, reject) => {
      if (this.zipfile) {
        tmp.setGracefulCleanup();
        const dir = promisify(tmp.dir);
        //@ts-expect-error promisify doesn't recognize the ZipFileOptions parameter
        dir({ unsafeCleanup: true }).then((res) => {
          this.output = res;
          this.zipfile.on('end', () => resolve(this.files));
          this.zipfile.readEntry();
        });
      } else {
        d('Tried to unzip file, but file does not exist');
        reject('Tried to unzip file, but file does not exist');
      }
    });
  }

  public handleDirectory(entry: Entry): Promise<void> {
    d(`Found directory: ${entry.fileName}`);
    return fs.ensureDir(path.join(this.output, entry.fileName));
  }

  public async handleFile(entry: Entry) {
    let outputFileName = entry.fileName;
    const incrementor = this.uniqueFileNameCount.get(entry.fileName);

    if (typeof incrementor === 'number') {
      const ext = path.extname(outputFileName);
      const name = path.basename(outputFileName, ext);
      outputFileName = `${name}${incrementor}${ext}`;
      this.uniqueFileNameCount.set(entry.fileName, incrementor + 1);
    } else {
      this.uniqueFileNameCount.set(entry.fileName, 1);
    }

    const targetPath = path.join(this.output, outputFileName);

    d(`Found file: ${outputFileName}, Size: ${entry.compressedSize}.`);

    if (shouldIgnoreFile(entry.fileName)) return;

    // Ensure the parent directory is created
    const dir = path.dirname(targetPath);
    await fs.mkdirp(dir);

    const readStream = await new Promise<NodeJS.ReadableStream>(
      (resolve, reject) => {
        this.zipfile.openReadStream(
          entry,
          async (error: Error, zipStream: NodeJS.ReadableStream) => {
            if (error) {
              d(
                `Encountered error while trying to read stream for ${outputFileName}`,
              );
              return reject(error);
            }

            resolve(zipStream);
          },
        );
      },
    );

    await pipeline(readStream, fs.createWriteStream(targetPath));

    this.files.push({
      fileName: outputFileName,
      size: entry.uncompressedSize || 0,
      fullPath: targetPath,
      id: targetPath,
      type: 'UnzippedFile',
    });

    d(`Successfully unzipped ${entry.fileName} to ${targetPath}`);
  }

  public async handleEntry(entry: Entry) {
    if (/\/$/.test(entry.fileName)) {
      await this.handleDirectory(entry);
    } else {
      await this.handleFile(entry);
    }

    this.zipfile.readEntry();
  }

  public clean() {
    if (this.output) {
      return fs.remove(this.output);
    } else {
      d('Called clean, but no temp directory created. No need to clean!');
      return Promise.resolve();
    }
  }
}
