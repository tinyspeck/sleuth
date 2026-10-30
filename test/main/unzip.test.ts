import { expect, it, describe } from 'vitest';
import { Unzipper } from '../../src/main/unzip';
import fs from 'node:fs';
import path from 'path';

describe('Unzipper', () => {
  it('should read a simple zip file', async () => {
    const simple = path.join(__dirname, '../static/simple.zip');
    const unzipper = new Unzipper(simple);

    return unzipper
      .open()
      .then(() => unzipper.unzip())
      .then((files) => {
        expect(files).toHaveLength(2);
        return unzipper.clean();
      });
  });

  it('should read a simple zip file with folders', async () => {
    const simple = path.join(__dirname, '../static/simple-with-folders.zip');
    const unzipper = new Unzipper(simple);

    return unzipper
      .open()
      .then(() => unzipper.unzip())
      .then((files) => {
        expect(files).toHaveLength(3);
        return unzipper.clean();
      });
  });

  it('should read a zip with a stored entry whose sizes mismatch', async () => {
    const zip = path.join(__dirname, '../static/stored-size-mismatch.zip');
    const unzipper = new Unzipper(zip);

    await unzipper.open();
    const files = await unzipper.unzip();
    expect(files.map((f) => f.fileName).sort()).toEqual([
      'ShipIt_stdout.log',
      'browser.log',
    ]);

    const empty = files.find((f) => f.fileName === 'ShipIt_stdout.log')!;
    expect(fs.readFileSync(empty.fullPath, 'utf8')).toBe('');
    await unzipper.clean();
  });

  it('should reject a deflated entry larger than its declared size', async () => {
    const zip = path.join(__dirname, '../static/deflated-size-mismatch.zip');
    const unzipper = new Unzipper(zip);

    await unzipper.open();
    await expect(unzipper.unzip()).rejects.toThrow(
      'browser.log is larger than its declared size of 10 bytes',
    );
    await unzipper.clean();
  });

  it('should reject an entry declared larger than the entry limit', async () => {
    const zip = path.join(__dirname, '../static/simple.zip');
    const unzipper = new Unzipper(zip, { maxEntryBytes: 5 });

    await unzipper.open();
    await expect(unzipper.unzip()).rejects.toThrow(
      'test-one.txt is too large to extract (6 bytes)',
    );
    await unzipper.clean();
  });

  it('should reject an archive larger than the total limit', async () => {
    const zip = path.join(__dirname, '../static/simple.zip');
    const unzipper = new Unzipper(zip, { maxTotalBytes: 8 });

    await unzipper.open();
    await expect(unzipper.unzip()).rejects.toThrow(
      'Archive exceeds the maximum extracted size of 8 bytes',
    );
    await unzipper.clean();
  });

  // TODO: this is easy to test but hard to generate a fixture with fake data
  it.todo('can handle non-unique file names');
});
