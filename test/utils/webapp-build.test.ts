import { describe, it, expect } from 'vitest';
import {
  accumulateWebappBuild,
  extractWebappBuildMarker,
  mergeWebappBuilds,
  webappBuildKey,
  WebappBuild,
} from '../../src/utils/webapp-build';

describe('extractWebappBuildMarker', () => {
  it('extracts SHA and cacheKey from a full gantry bundle URL', () => {
    const line =
      'a.slack-edge.com/bv1-8/gantry-shared.75d2ab5.min.js?cacheKey=gantry-1600974368:1';
    expect(extractWebappBuildMarker(line)).toEqual({
      sha: '75d2ab5',
      cacheKey: '1600974368',
    });
  });

  it('extracts SHA when only the bundle filename is present (no cacheKey)', () => {
    const line = '11:50:18.322 gantry-shared.f1348ec.min.js:1 some message';
    expect(extractWebappBuildMarker(line)).toEqual({ sha: 'f1348ec' });
  });

  it('extracts cacheKey from a service-worker cache-bucket line (no SHA)', () => {
    const line =
      '[SERVICE-WORKER] checking if asset is in an existing cache bucket: gantry-1611070538 https://a.slack-edge.com/';
    expect(extractWebappBuildMarker(line)).toEqual({ cacheKey: '1611070538' });
  });

  it('returns null for a noversion line', () => {
    const line =
      '11:50:10.297 [API-Q] (T34263EUF) noversion-1611085810.297 Flannel users/info is ENQUEUED';
    expect(extractWebappBuildMarker(line)).toBeNull();
  });

  it('returns null for lines without a gantry reference', () => {
    expect(extractWebappBuildMarker('just a normal log line')).toBeNull();
    expect(extractWebappBuildMarker('')).toBeNull();
  });
});

describe('webappBuildKey', () => {
  it('keys by SHA when present', () => {
    expect(webappBuildKey({ sha: 'abc123', cacheKey: '999' })).toBe(
      'sha:abc123',
    );
  });

  it('falls back to cacheKey bucket when there is no SHA', () => {
    expect(webappBuildKey({ cacheKey: '999' })).toBe('bucket:999');
  });

  it('returns null when neither is present', () => {
    expect(webappBuildKey({})).toBeNull();
  });
});

describe('accumulateWebappBuild', () => {
  it('records a new build with matching first/last-seen', () => {
    const acc = accumulateWebappBuild({}, { sha: 'aaa' }, 100);
    expect(acc['sha:aaa']).toEqual({
      sha: 'aaa',
      cacheKey: undefined,
      firstSeen: 100,
      lastSeen: 100,
    });
  });

  it('widens the window across repeated sightings', () => {
    let acc: Record<string, WebappBuild> = {};
    acc = accumulateWebappBuild(acc, { sha: 'aaa' }, 200);
    acc = accumulateWebappBuild(acc, { sha: 'aaa' }, 100);
    acc = accumulateWebappBuild(acc, { sha: 'aaa' }, 300);
    expect(acc['sha:aaa'].firstSeen).toBe(100);
    expect(acc['sha:aaa'].lastSeen).toBe(300);
  });

  it('backfills a cacheKey seen on a later line for a SHA-first build', () => {
    let acc: Record<string, WebappBuild> = {};
    acc = accumulateWebappBuild(acc, { sha: 'aaa' }, 100);
    acc = accumulateWebappBuild(acc, { sha: 'aaa', cacheKey: '555' }, 150);
    expect(acc['sha:aaa'].cacheKey).toBe('555');
  });

  it('does not let an undated (0) sighting pull firstSeen down to 0', () => {
    let acc: Record<string, WebappBuild> = {};
    acc = accumulateWebappBuild(acc, { sha: 'aaa' }, 500);
    acc = accumulateWebappBuild(acc, { sha: 'aaa' }, 0);
    expect(acc['sha:aaa'].firstSeen).toBe(500);
    expect(acc['sha:aaa'].lastSeen).toBe(500);
  });

  it('ignores markers with no usable identity', () => {
    const acc = accumulateWebappBuild({}, {}, 100);
    expect(Object.keys(acc)).toHaveLength(0);
  });
});

describe('mergeWebappBuilds', () => {
  it('merges per-file maps, dedupes by SHA, and sorts newest-lastSeen first', () => {
    const fileA: Record<string, WebappBuild> = {
      'sha:old': { sha: 'old', firstSeen: 100, lastSeen: 200 },
      'sha:new': { sha: 'new', firstSeen: 300, lastSeen: 400 },
    };
    const fileB: Record<string, WebappBuild> = {
      'sha:old': { sha: 'old', firstSeen: 50, lastSeen: 250 },
    };

    const merged = mergeWebappBuilds([fileA, fileB]);
    expect(merged).toHaveLength(2);
    // newest lastSeen (new @400) comes first
    expect(merged[0].sha).toBe('new');
    // union of windows for the shared build
    expect(merged[1]).toMatchObject({
      sha: 'old',
      firstSeen: 50,
      lastSeen: 250,
    });
  });

  it('coalesces a bucket-only build into the SHA build sharing its cacheKey', () => {
    const map: Record<string, WebappBuild> = {
      'sha:f1348ec': {
        sha: 'f1348ec',
        cacheKey: '1611070538',
        firstSeen: 300,
        lastSeen: 400,
      },
      // Service-worker line saw only the bucket, no SHA.
      'bucket:1611070538': {
        cacheKey: '1611070538',
        firstSeen: 500,
        lastSeen: 600,
      },
    };

    const merged = mergeWebappBuilds([map]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      sha: 'f1348ec',
      cacheKey: '1611070538',
      firstSeen: 300,
      lastSeen: 600,
    });
  });

  it('never unions two distinct SHAs that transiently share a cacheKey', () => {
    const map: Record<string, WebappBuild> = {
      'sha:aaa': { sha: 'aaa', cacheKey: 'k', firstSeen: 100, lastSeen: 200 },
      'sha:bbb': { sha: 'bbb', cacheKey: 'k', firstSeen: 300, lastSeen: 400 },
    };

    const merged = mergeWebappBuilds([map]);
    expect(merged).toHaveLength(2);
    expect(merged.map((b) => b.sha).sort()).toEqual(['aaa', 'bbb']);
  });

  it('skips undefined maps', () => {
    const merged = mergeWebappBuilds([
      undefined,
      { 'sha:x': { sha: 'x', firstSeen: 1, lastSeen: 2 } },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sha).toBe('x');
  });

  it('returns an empty array when there are no builds', () => {
    expect(mergeWebappBuilds([])).toEqual([]);
    expect(mergeWebappBuilds([{}])).toEqual([]);
  });
});
