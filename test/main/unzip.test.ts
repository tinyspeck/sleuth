import { expect, it, describe } from 'vitest';
import { Unzipper } from '../../src/main/unzip';
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

  // TODO: this is easy to test but hard to generate a fixture with fake data
  it.todo('can handle non-unique file names');
});
