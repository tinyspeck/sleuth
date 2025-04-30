import path from 'node:path';

import fs from 'node:fs';

const packageJSON = JSON.parse(
  fs
    .readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8')
    .trim(),
);

/**
 * This is a temporary implementation of the preload script while nodeIntegration
 * is still enabled. This provides a familiar `window.Sleuth` interface to the global
 * scope of the app while being open to being replaced with a more secure contextBridge
 * implementation in the future.
 */
(window as any).Sleuth = {
  platform: process.platform,
  versions: process.versions,
  sleuthVersion: packageJSON.version,
};
