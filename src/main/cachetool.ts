import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { dialog } from 'electron';

export async function download(dataPath: string) {
  if (!dataPath) return;

  const filename = path.basename(dataPath);
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: filename,
  });

  if (filePath) {
    try {
      await fs.copyFile(dataPath, filePath);
    } catch (error) {
      console.error(`Cachetool download()`, error);
    }
  }
}

export async function getHeaders(cachePath?: string, key?: string) {
  if (!cachePath || !key) return '';

  try {
    const { getStream } = await import('cachetool');

    return (await getStream({ cachePath, key })).toString();
  } catch (error) {
    return '';
  }
}

export async function getData(
  cachePath?: string,
  key?: string,
): Promise<string | undefined> {
  if (!cachePath || !key) return '';

  try {
    const { getStream } = await import('cachetool');
    const data = await getStream({
      cachePath,
      key,
      index: 1,
    });

    const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'sleuth'));

    const fileName = path.basename(key);
    const targetPath = path.join(tmpdir, fileName);
    await fs.emptyDir(tmpdir);
    await fs.writeFile(targetPath, data);

    return targetPath;
  } catch (error) {
    console.error(`Cachetool getData()`, error);

    return undefined;
  }
}
