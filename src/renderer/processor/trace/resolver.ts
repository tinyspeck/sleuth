import path from 'path';
import fs from 'fs-extra';
import fetch from 'node-fetch';
import { RawSourceMap } from 'source-map';
import { USER_AGENT } from '../../../shared-constants';

const debug = require('debug')('sleuth:sourcemap-resolver');

const getPantryURL = (sha: string, filename: string) =>
  `https://slack-pantry.tinyspeck.com/source-maps/${sha}/${filename}.map`;

const getCachePath = (basePath: string, filename: string) => {
  const t = path.normalize(`${basePath}/maps/${filename}.map`);
  return t;
};

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

  private async getFromCache(
    filename: string
  ): Promise<RawSourceMap | undefined> {
    try {
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
        'User-Agent': USER_AGENT,
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
