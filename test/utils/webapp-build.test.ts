import { describe, it, expect } from 'vitest';
import {
  accumulateWebappBuild,
  extractVersionField,
  mergeWebappBuilds,
  WebappBuild,
} from '../../src/utils/webapp-build';

describe('extractVersionField', () => {
  it('extracts the version_hash from a [VERSION] line', () => {
    const line =
      '[06/16/26, 09:52:12:312] info: [VERSION] version_hash: 1ae9268c6546cd002c66bea39720f4cebfbfd1d9';
    expect(extractVersionField(line)).toEqual({
      hash: '1ae9268c6546cd002c66bea39720f4cebfbfd1d9',
    });
  });

  it('extracts the version_ts from a [VERSION] line', () => {
    const line =
      '[06/16/26, 09:52:12:312] info: [VERSION] version_ts: 1781553767';
    expect(extractVersionField(line)).toEqual({ ts: 1781553767 });
  });

  it('also accepts the build_version_ts field name', () => {
    expect(
      extractVersionField('[VERSION] build_version_ts: 1784575952'),
    ).toEqual({ ts: 1784575952 });
  });

  it('returns null for lines without a [VERSION] block', () => {
    expect(extractVersionField('just a normal log line')).toBeNull();
    expect(
      extractVersionField('[VERSION] min_version_data_ts: 1722374725'),
    ).toBeNull();
    expect(extractVersionField('')).toBeNull();
  });
});

describe('accumulateWebappBuild', () => {
  it('records a new build with SHA, build ts, and observed time', () => {
    const acc = accumulateWebappBuild({}, 'aaa', 1781553767, 100);
    expect(acc.aaa).toEqual({
      sha: 'aaa',
      buildTs: 1781553767,
      firstSeen: 100,
      lastSeen: 100,
    });
  });

  it('backfills the build ts when first seen without one', () => {
    let acc: Record<string, WebappBuild> = {};
    acc = accumulateWebappBuild(acc, 'aaa', 0, 100); // version_hash line
    acc = accumulateWebappBuild(acc, 'aaa', 1781553767, 100); // version_ts line
    expect(acc.aaa.buildTs).toBe(1781553767);
  });

  it('widens the observed window; an undated (0) sighting never lowers it', () => {
    let acc: Record<string, WebappBuild> = {};
    acc = accumulateWebappBuild(acc, 'aaa', 1, 500);
    acc = accumulateWebappBuild(acc, 'aaa', 1, 0);
    acc = accumulateWebappBuild(acc, 'aaa', 1, 800);
    expect(acc.aaa).toMatchObject({ firstSeen: 500, lastSeen: 800 });
  });
});

describe('mergeWebappBuilds', () => {
  it('dedupes by SHA and sorts newest build ts first', () => {
    const fileA: Record<string, WebappBuild> = {
      old: { sha: 'old', buildTs: 100, firstSeen: 10, lastSeen: 20 },
      new: { sha: 'new', buildTs: 300, firstSeen: 30, lastSeen: 40 },
    };
    const fileB: Record<string, WebappBuild> = {
      old: { sha: 'old', buildTs: 100, firstSeen: 5, lastSeen: 25 },
    };

    const merged = mergeWebappBuilds([fileA, fileB]);
    expect(merged.map((b) => b.sha)).toEqual(['new', 'old']);
    expect(merged[1]).toMatchObject({ firstSeen: 5, lastSeen: 25 });
  });

  it('backfills a missing build ts from another file', () => {
    const merged = mergeWebappBuilds([
      { x: { sha: 'x', buildTs: 0, firstSeen: 1, lastSeen: 2 } },
      { x: { sha: 'x', buildTs: 999, firstSeen: 3, lastSeen: 4 } },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].buildTs).toBe(999);
  });

  it('skips undefined maps and returns empty for no builds', () => {
    expect(mergeWebappBuilds([undefined, {}])).toEqual([]);
  });
});
