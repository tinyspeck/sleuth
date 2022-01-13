import { shouldIgnoreFile } from '../../src/utils/should-ignore-file';

describe('shouldIgnoreFile', () => {
  it('should ignore .DS_Store', () => {
    expect(shouldIgnoreFile('.DS_Store')).toBe(true);
  });

  it('should not ignore rando file', () => {
    expect(shouldIgnoreFile('hiitme')).toBe(false);
  });
});
