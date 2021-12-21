import { getSleuth } from '../../src/renderer/sleuth';

const sleuths = ['🕵', '🕵️‍♀️', '🕵🏻', '🕵🏼', '🕵🏽', '🕵🏾', '🕵🏿', '🕵🏻‍♀️', '🕵🏼‍♀️', '🕵🏽‍♀️', '🕵🏾‍♀️', '🕵🏿‍♀️'];

describe('getSleuth', () => {
  it('should return a Sleuth 🕵', () => {
    expect(sleuths).toContain(getSleuth());
  });

  it('should return a Sleuth 🕵 (win32, 8)', () => {
    expect(sleuths).toContain(getSleuth('win32', '8'));
  });

  it('should return a Sleuth 🕵 (win32, 10)', () => {
    expect(sleuths).toContain(getSleuth('win32', '10.0'));
  });

  it('should return a Sleuth 🕵 (darwin)', () => {
    expect(sleuths).toContain(getSleuth('darwin'));
  });
});
