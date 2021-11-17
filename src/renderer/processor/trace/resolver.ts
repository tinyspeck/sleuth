import path from 'path';
import fs from 'fs-extra';
import fetch from 'node-fetch';
import { RawSourceMap } from 'source-map';
import { getUserAgent } from '../../ipc';

const debug = require('debug')('sleuth:sourcemap-resolver');

const getPantryURL = (sha: string, filename: string) =>
  `https://slack-pantry.tinyspeck.com/source-maps/${sha}/${filename}.map`;

const getCachePath = (basePath: string, filename: string) => {
  const t = path.normalize(`${basePath}/maps/${filename}.map`);
  return t;
};

interface FileInfo {
  name: string;
  modified: Date;
  size: number;
}

export class SourcemapResolver {
  sha: string;
  cookie: string;
  cacheRoot: string;
  missing: Set<string> = new Set();
  constructor(sha: string, cookie: string, cacheRoot: string) {
    this.sha = sha;
    this.cookie = cookie;
    this.cacheRoot = cacheRoot;
  }

  private async ensureCacheSize(cacheDir: string, sizeLimit: number = 500 * 1000 * 1000) {
    try {
      await fs.access(cacheDir, fs.constants.F_OK);
    } catch (e) {
      // directory does not exist, return
      return;
    }
    const readPromise = await fs.readdir(cacheDir);
    const statPromises: Array<Promise<FileInfo>> = readPromise.map(async (fileName) => {
      const stat = await fs.stat(`${cacheDir}/${fileName}`);
      return {
        name: fileName,
        modified: stat.mtime,
        size: stat.size,
      };
    });
    const files = await Promise.all(statPromises);
    const sorted = files.sort((a, b) => a.modified.getTime() - b.modified.getTime());
    let size = 0;
    const removePromises = [];
    for (const file of sorted) {
      size += file.size;
      if (size > sizeLimit) {
        debug(`Removing ${file.name} as cache size has exceeded limit`);
        removePromises.push(fs.remove(`${cacheDir}/${file.name}`));
      }
    }
    await Promise.all(removePromises);
  }

  private async getFromCache(
    filename: string
  ): Promise<RawSourceMap | undefined> {
    try {
      await this.ensureCacheSize(path.join(this.cacheRoot, 'maps'));
      const cachePath = getCachePath(this.cacheRoot, filename);
      const file = await fs.readFile(cachePath, 'utf8');
      const map = JSON.parse(file);
      debug(`Found ${filename} in cache`);
      return map;
    } catch (e) {
      //ignored
    }
    return undefined;
  }

  private async getFromNetwork(
    filename: string
  ): Promise<RawSourceMap | undefined> {
    if (this.missing.has(filename)) {
      debug(`Skipping ${filename} as it wasn't found earlier`);
      return;
    }

    debug(`Fetching ${filename} from network`);

    const url = getPantryURL(this.sha, filename);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': await getUserAgent(),
        Cookie: this.cookie,
      },
    });

    if (resp.status === 404) {
      this.missing.add(filename);
    } else if (resp.status !== 200) {
      debug(
        `Received a status code of ${resp.status} from ${url}, attempting to parse anyway`
      );
    }

    const sourcemap = await resp.json();

    // save in cache
    const cachePath = getCachePath(this.cacheRoot, filename);
    try {
      await fs.outputJSON(cachePath, sourcemap);
      debug(`Stored ${filename} in cache at ${cachePath}`);
    } catch (e) {
      //ignored
    }

    return sourcemap as RawSourceMap;
  }

  public async get(filename: string) {
    const cacheResult = await this.getFromCache(filename);
    if (cacheResult) {
      return cacheResult;
    }
    return this.getFromNetwork(filename);
  }
}
