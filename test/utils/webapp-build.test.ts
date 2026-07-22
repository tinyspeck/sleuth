import { describe, it, expect } from 'vitest';
import {
  accumulateWebappBuild,
  extractWebappBuildSha,
  mergeWebappBuilds,
  WebappBuild,
} from '../../src/utils/webapp-build';

describe('extractWebappBuildSha', () => {
  it('extracts the SHA from a legacy gantry-shared bundle URL', () => {
    const line =
      'a.slack-edge.com/bv1-8/gantry-shared.75d2ab5.min.js?cacheKey=gantry-1600974368:1';
    expect(extractWebappBuildSha(line)).toBe('75d2ab5');
  });

  it('extracts the SHA from a modern gantry-v2-shared bundle URL', () => {
    const line =
      'a.slack-edge.com/bv1-13-br/gantry-v2-shared.4d21793112932f67.min.js?cacheKey=gantry-1783629160:14';
    expect(extractWebappBuildSha(line)).toBe('4d21793112932f67');
  });

  it('extracts the SHA when the bundle appears with no cacheKey', () => {
    expect(
      extractWebappBuildSha('11:50:18.322 gantry-shared.f1348ec.min.js:1 msg'),
    ).toBe('f1348ec');
  });

  it('ignores async route chunks so one build is not counted many times', () => {
    // Each deploy ships dozens of these, each with its own content hash; only
    // the primary shared bundle identifies the build.
    expect(
      extractWebappBuildSha(
        'a.slack-edge.com/bv1-13-br/gantry-v2-async-gantry-v2-shared-boot-async.f95a718635c38636.min.js?x',
      ),
    ).toBeNull();
    expect(
      extractWebappBuildSha(
        'a.slack-edge.com/bv1-13-br/gantry-v2-async-client-v2-Foo.9a1c393c32246aa4e878.min.js',
      ),
    ).toBeNull();
  });

  it('returns null for lines that name no gantry bundle', () => {
    expect(extractWebappBuildSha('just a normal log line')).toBeNull();
    expect(extractWebappBuildSha('cache bucket: gantry-1611070538')).toBeNull();
    expect(extractWebappBuildSha('')).toBeNull();
  });
});

describe('accumulateWebappBuild', () => {
  it('records a new build with matching first/last-seen', () => {
    const acc = accumulateWebappBuild({}, 'aaa', 100);
    expect(acc.aaa).toEqual({ sha: 'aaa', firstSeen: 100, lastSeen: 100 });
  });

  it('widens the window across repeated sightings', () => {
    let acc: Record<string, WebappBuild> = {};
    acc = accumulateWebappBuild(acc, 'aaa', 200);
    acc = accumulateWebappBuild(acc, 'aaa', 100);
    acc = accumulateWebappBuild(acc, 'aaa', 300);
    expect(acc.aaa).toMatchObject({ firstSeen: 100, lastSeen: 300 });
  });

  it('does not let an undated (0) sighting pull firstSeen down to 0', () => {
    let acc: Record<string, WebappBuild> = {};
    acc = accumulateWebappBuild(acc, 'aaa', 500);
    acc = accumulateWebappBuild(acc, 'aaa', 0);
    expect(acc.aaa).toMatchObject({ firstSeen: 500, lastSeen: 500 });
  });
});

describe('mergeWebappBuilds', () => {
  it('merges per-file maps, dedupes by SHA, and sorts newest-lastSeen first', () => {
    const fileA: Record<string, WebappBuild> = {
      old: { sha: 'old', firstSeen: 100, lastSeen: 200 },
      new: { sha: 'new', firstSeen: 300, lastSeen: 400 },
    };
    const fileB: Record<string, WebappBuild> = {
      old: { sha: 'old', firstSeen: 50, lastSeen: 250 },
    };

    const merged = mergeWebappBuilds([fileA, fileB]);
    expect(merged.map((b) => b.sha)).toEqual(['new', 'old']);
    expect(merged[1]).toMatchObject({ firstSeen: 50, lastSeen: 250 });
  });

  it('skips undefined maps and returns empty for no builds', () => {
    expect(mergeWebappBuilds([undefined, {}])).toEqual([]);
    const merged = mergeWebappBuilds([
      undefined,
      { x: { sha: 'x', firstSeen: 1, lastSeen: 2 } },
    ]);
    expect(merged.map((b) => b.sha)).toEqual(['x']);
  });
});
