import { describe, it, expect } from 'vitest';
import { getWebappVersionInfo } from '../../src/renderer/components/derive-dashboard-data';

describe('getWebappVersionInfo', () => {
  it('extracts the raw version and short SHA from the first team that has it', () => {
    const rootState = {
      webapp: {
        teams: {
          T111: { version: '1a2b3c4@1600974368' },
        },
      },
    };

    expect(getWebappVersionInfo(rootState)).toEqual({
      raw: '1a2b3c4@1600974368',
      sha: '1a2b3c4',
    });
  });

  it('skips teams without a version and uses the first one that has it', () => {
    const rootState = {
      webapp: {
        teams: {
          T111: {},
          T222: { version: 'deadbee@1611070538' },
        },
      },
    };

    expect(getWebappVersionInfo(rootState)?.sha).toBe('deadbee');
  });

  it('returns the whole string as the SHA when there is no @ separator', () => {
    const rootState = { webapp: { teams: { T111: { version: 'abc123' } } } };

    expect(getWebappVersionInfo(rootState)).toEqual({
      raw: 'abc123',
      sha: 'abc123',
    });
  });

  it('returns null when no team has a version', () => {
    const rootState = { webapp: { teams: { T111: {}, T222: {} } } };

    expect(getWebappVersionInfo(rootState)).toBeNull();
  });

  it('returns null when webapp state is missing or malformed', () => {
    expect(getWebappVersionInfo(undefined)).toBeNull();
    expect(getWebappVersionInfo({})).toBeNull();
    expect(getWebappVersionInfo({ webapp: {} })).toBeNull();
    expect(getWebappVersionInfo({ webapp: { teams: null } })).toBeNull();
  });

  it('ignores non-string or empty version values', () => {
    expect(
      getWebappVersionInfo({ webapp: { teams: { T111: { version: '' } } } }),
    ).toBeNull();
    expect(
      getWebappVersionInfo({ webapp: { teams: { T111: { version: 42 } } } }),
    ).toBeNull();
  });
});
