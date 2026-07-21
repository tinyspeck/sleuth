/**
 * Webapp (JS client) build detection from console log lines.
 *
 * The webapp is served as gantry bundles whose filenames embed a short build
 * SHA and whose cache buckets embed a timestamp, e.g.:
 *
 *   a.slack-edge.com/bv1-8/gantry-shared.75d2ab5.min.js?cacheKey=gantry-1600974368:1
 *   gantry-shared.f1348ec.min.js?cacheKey=gantry-1611070538:1
 *   [SERVICE-WORKER] checking if asset is in an existing cache bucket: gantry-1611070538
 *
 * A log bundle can span up to two weeks, during which the webapp may reload
 * onto newer builds, so a single bundle can contain more than one SHA. The
 * SHA is the stable build identity; the cacheKey timestamp is a fallback for
 * service-worker lines that mention only a cache bucket.
 */

// gantry-shared.<sha>.min.js[?cacheKey=gantry-<ts>]
const GANTRY_BUNDLE_RGX =
  /gantry-shared\.([0-9a-f]{6,40})\.min\.js(?:\?cacheKey=gantry-(\d+))?/;

// ...cache bucket: gantry-<ts>  (no SHA present)
const GANTRY_BUCKET_RGX = /cache bucket: gantry-(\d+)/;

export interface WebappBuildMarker {
  /** Short build SHA (e.g. `f1348ec`), when the line names a bundle file. */
  sha?: string;
  /** gantry cache-bucket timestamp (e.g. `1611070538`), when present. */
  cacheKey?: string;
}

/**
 * Extracts a webapp build marker (SHA and/or cacheKey) from a single log
 * line, or `null` if the line names no gantry build.
 *
 * Cheap-guards on the substring `gantry-` before running any regex so this is
 * safe to call on every line of a large console log.
 */
export function extractWebappBuildMarker(
  line: string,
): WebappBuildMarker | null {
  // Fast path: the overwhelming majority of lines have no gantry reference.
  if (!line.includes('gantry-')) {
    return null;
  }

  const bundle = GANTRY_BUNDLE_RGX.exec(line);
  if (bundle) {
    const marker: WebappBuildMarker = { sha: bundle[1] };
    if (bundle[2]) {
      marker.cacheKey = bundle[2];
    }
    return marker;
  }

  const bucket = GANTRY_BUCKET_RGX.exec(line);
  if (bucket) {
    return { cacheKey: bucket[1] };
  }

  return null;
}

/**
 * A distinct webapp build observed in a log window, bracketed by the first
 * and last timestamps at which it was seen.
 */
export interface WebappBuild {
  sha?: string;
  cacheKey?: string;
  /** momentValue (epoch ms) of the earliest line naming this build. */
  firstSeen: number;
  /** momentValue (epoch ms) of the latest line naming this build. */
  lastSeen: number;
}

/**
 * The identity we dedupe builds by: the SHA when present (stable across cache
 * buckets), otherwise the cacheKey bucket timestamp.
 */
export function webappBuildKey(
  marker: Pick<WebappBuild, 'sha' | 'cacheKey'>,
): string | null {
  if (marker.sha) {
    return `sha:${marker.sha}`;
  }
  if (marker.cacheKey) {
    return `bucket:${marker.cacheKey}`;
  }
  return null;
}

/**
 * Folds a build marker seen at `momentValue` into an accumulator map keyed by
 * {@link webappBuildKey}, widening the first/last-seen window. Mutates and
 * returns `acc`. A `momentValue` of 0 (undated line) still records the build
 * but does not move the window bounds inward from real timestamps.
 */
export function accumulateWebappBuild(
  acc: Record<string, WebappBuild>,
  marker: WebappBuildMarker,
  momentValue: number,
): Record<string, WebappBuild> {
  const key = webappBuildKey(marker);
  if (!key) {
    return acc;
  }

  const existing = acc[key];
  if (!existing) {
    acc[key] = {
      sha: marker.sha,
      cacheKey: marker.cacheKey,
      firstSeen: momentValue,
      lastSeen: momentValue,
    };
    return acc;
  }

  // A later line may carry the cacheKey for a build first seen without one.
  if (!existing.cacheKey && marker.cacheKey) {
    existing.cacheKey = marker.cacheKey;
  }

  if (momentValue > 0) {
    if (existing.firstSeen === 0 || momentValue < existing.firstSeen) {
      existing.firstSeen = momentValue;
    }
    if (momentValue > existing.lastSeen) {
      existing.lastSeen = momentValue;
    }
  }

  return acc;
}

function unionBuild(target: WebappBuild, source: WebappBuild): void {
  if (!target.sha && source.sha) {
    target.sha = source.sha;
  }
  if (!target.cacheKey && source.cacheKey) {
    target.cacheKey = source.cacheKey;
  }
  const first = [target.firstSeen, source.firstSeen].filter((n) => n > 0);
  target.firstSeen = first.length ? Math.min(...first) : 0;
  target.lastSeen = Math.max(target.lastSeen, source.lastSeen);
}

/**
 * Merges several per-file build maps into a single deduped, chronologically
 * sorted list (newest last-seen first).
 *
 * A gantry build has two identifiers — a SHA and a cacheKey bucket timestamp —
 * and either may appear alone on a given line (e.g. service-worker lines carry
 * only the bucket). Builds are therefore coalesced across BOTH identifiers: a
 * bucket-only marker folds into the SHA build that shares its cacheKey, so we
 * don't double-count one build as two. Their first/last-seen windows union.
 */
export function mergeWebappBuilds(
  maps: Array<Record<string, WebappBuild> | undefined>,
): Array<WebappBuild> {
  const builds: Array<WebappBuild> = [];
  // Indexes from each identifier to the canonical build it belongs to.
  const bySha = new Map<string, WebappBuild>();
  const byCacheKey = new Map<string, WebappBuild>();

  for (const map of maps) {
    if (!map) {
      continue;
    }
    for (const incoming of Object.values(map)) {
      if (!webappBuildKey(incoming)) {
        continue;
      }

      // Coalesce on SHA (stable build identity) first. Only fall back to the
      // cacheKey index to fold in a marker where one side lacks a SHA — never
      // union two builds that both carry a (different) SHA, even if they
      // transiently share a bucket timestamp.
      const shaMatch = incoming.sha ? bySha.get(incoming.sha) : undefined;
      const cacheKeyMatch = incoming.cacheKey
        ? byCacheKey.get(incoming.cacheKey)
        : undefined;
      const safeCacheKeyMatch =
        cacheKeyMatch && (!incoming.sha || !cacheKeyMatch.sha)
          ? cacheKeyMatch
          : undefined;
      const match = shaMatch ?? safeCacheKeyMatch ?? null;

      const target =
        match ??
        (() => {
          const created: WebappBuild = { ...incoming };
          builds.push(created);
          return created;
        })();

      if (match) {
        unionBuild(target, incoming);
      }

      // (Re)index by whichever identifiers this build now has.
      if (target.sha) {
        bySha.set(target.sha, target);
      }
      if (target.cacheKey) {
        byCacheKey.set(target.cacheKey, target);
      }
    }
  }

  return builds.sort((a, b) => b.lastSeen - a.lastSeen);
}
