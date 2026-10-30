import debug from 'debug';
import fs from 'fs-extra';
import tmp from 'tmp';
import yauzl, { Entry, ZipFile, ZipFileOptions } from 'yauzl';

import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

import { shouldIgnoreFile } from '../utils/should-ignore-file';
import { UnzippedFile } from '../interfaces';

const d = debug('sleuth:unzip');

export interface UnzipLimits {
  // Maximum number of bytes extracted for a single entry
  maxEntryBytes: number;
  // Maximum number of bytes extracted for the whole archive
  maxTotalBytes: number;
}

const DEFAULT_LIMITS: UnzipLimits = {
  maxEntryBytes: 2 * 1024 ** 3,
  maxTotalBytes: 10 * 1024 ** 3,
};

/**
 * Handles unzipping a log archive.
 */
export class Unzipper {
  public readonly url: string;
  // Assigned in unzip() before use
  public output!: string;
  // Assigned in open() before use
  public zipfile!: ZipFile;
  public files: Array<UnzippedFile> = [];

  public uniqueFileNameCount: Map<string, number> = new Map();

  private readonly limits: UnzipLimits;
  private totalBytes = 0;

  constructor(url: string, limits: Partial<UnzipLimits> = {}) {
    this.url = url;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    d(`Created new Unzipper with url ${url}`);
  }

  public open() {
    return new Promise<void>((resolve, reject) => {
      // Some log bundles contain empty files marked as STORED but with a few
      // bytes of payload (an empty deflate block). We handle those in
      // handleFile() rather than letting yauzl reject the whole archive.
      // Since this also disables yauzl's check that deflated entries match
      // their declared size, handleFile() enforces sizes itself.
      const options = { lazyEntries: true, validateEntrySizes: false };
      yauzl.open(this.url, options, (error, zip) => {
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
          this.zipfile.on('error', reject);
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

    if (entry.uncompressedSize > this.limits.maxEntryBytes) {
      throw new Error(
        `${entry.fileName} is too large to extract (${entry.uncompressedSize} bytes)`,
      );
    }

    // Ensure the parent directory is created
    const dir = path.dirname(targetPath);
    await fs.mkdirp(dir);

    const readStream = await new Promise<NodeJS.ReadableStream>(
      (resolve, reject) => {
        // For STORED entries the sizes must match. If they don't, trust
        // uncompressedSize and only read that many bytes.
        const isStoredSizeMismatch =
          entry.compressionMethod === 0 &&
          !entry.isEncrypted() &&
          entry.compressedSize !== entry.uncompressedSize;
        const options: ZipFileOptions = {
          decompress: null,
          decrypt: null,
          start: isStoredSizeMismatch ? 0 : null,
          end: isStoredSizeMismatch
            ? Math.min(entry.compressedSize, entry.uncompressedSize)
            : null,
        };

        if (isStoredSizeMismatch) {
          d(
            `Size mismatch for stored file ${entry.fileName}: ${entry.compressedSize} != ${entry.uncompressedSize}`,
          );
        }

        this.zipfile.openReadStream(
          entry,
          options,
          async (error: Error | null, zipStream: NodeJS.ReadableStream) => {
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

    await pipeline(
      readStream,
      this.createSizeLimiter(entry),
      fs.createWriteStream(targetPath),
    );

    this.files.push({
      fileName: outputFileName,
      size: entry.uncompressedSize || 0,
      fullPath: targetPath,
      id: targetPath,
      type: 'UnzippedFile',
    });

    d(`Successfully unzipped ${entry.fileName} to ${targetPath}`);
  }

  /**
   * Errors if an entry inflates past its declared size, or if the archive
   * exceeds the configured extraction limits (e.g. a zip bomb).
   */
  private createSizeLimiter(entry: Entry): Transform {
    const maxEntryBytes = Math.min(
      entry.uncompressedSize,
      this.limits.maxEntryBytes,
    );
    let entryBytes = 0;

    return new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        entryBytes += chunk.length;
        this.totalBytes += chunk.length;

        if (entryBytes > maxEntryBytes) {
          return callback(
            new Error(
              `${entry.fileName} is larger than its declared size of ${entry.uncompressedSize} bytes`,
            ),
          );
        }

        if (this.totalBytes > this.limits.maxTotalBytes) {
          return callback(
            new Error(
              `Archive exceeds the maximum extracted size of ${this.limits.maxTotalBytes} bytes`,
            ),
          );
        }

        callback(null, chunk);
      },
    });
  }

  public async handleEntry(entry: Entry) {
    try {
      if (/\/$/.test(entry.fileName)) {
        await this.handleDirectory(entry);
      } else {
        await this.handleFile(entry);
      }
    } catch (error) {
      d(`Failed to extract ${entry.fileName}`, error);
      this.zipfile.close();
      this.zipfile.emit('error', error);
      return;
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
