import yauzl, { Entry, ZipFile } from 'yauzl';
import fs from 'fs-extra';
import path from 'path';
import * as stream from 'stream';
import tmp from 'tmp';
import { promisify } from 'util';
import debug from 'debug';

import { shouldIgnoreFile } from '../utils/should-ignore-file';
import { UnzippedFile } from '../interfaces';

const d = debug('sleuth:unzip');
const pipeline = promisify(stream.pipeline);

export class Unzipper {
  public readonly url: string;
  public output: string;
  public zipfile: ZipFile;
  public files: Array<UnzippedFile> = [];

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
        dir({ unsafeCleanup: true }).then(res => {
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
    const targetPath = path.join(this.output, entry.fileName);

    d(`Found file: ${entry.fileName}, Size: ${entry.compressedSize}.`);

    if (shouldIgnoreFile(entry.fileName)) return;

    // Ensure the parent directory is created
    const dir = path.dirname(targetPath);
    await fs.mkdirp(dir);

    const readStream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      this.zipfile.openReadStream(entry, async (error: Error, zipStream: NodeJS.ReadableStream) => {
        if (error) {
          d(`Encountered error while trying to read stream for ${entry.fileName}`);
          return reject(error);
        }

        resolve(zipStream);
      });
    });

    await pipeline(readStream, fs.createWriteStream(targetPath));

    this.files.push({
      fileName: entry.fileName,
      size: entry.uncompressedSize || 0,
      fullPath: targetPath,
      id: targetPath,
      type: 'UnzippedFile'
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
