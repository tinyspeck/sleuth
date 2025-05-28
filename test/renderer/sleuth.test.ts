import { beforeAll, describe, it, expect } from 'vitest';

import { getSleuth } from '../../src/renderer/sleuth';

const sleuths = [
  '🕵',
  '🕵️‍♀️',
  '🕵🏻',
  '🕵🏼',
  '🕵🏽',
  '🕵🏾',
  '🕵🏿',
  '🕵🏻‍♀️',
  '🕵🏼‍♀️',
  '🕵🏽‍♀️',
  '🕵🏾‍♀️',
  '🕵🏿‍♀️',
];

describe('getSleuth', () => {
  beforeAll(() => {
    (window as any).Sleuth = { platform: 'darwin' };
  });

  it('should return a Sleuth 🕵', () => {
    expect(sleuths).toContain(getSleuth());
  });

  it('should return a Sleuth 🕵 (win32)', () => {
    expect(sleuths).toContain(getSleuth('win32'));
  });

  it('should return a Sleuth 🕵 (darwin)', () => {
    expect(sleuths).toContain(getSleuth('darwin'));
  });
});
