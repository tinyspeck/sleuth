/**
 * Webapp (JS client) build detection from console log lines.
 *
 * The webapp is served as gantry bundles whose filenames embed a content-hash
 * build SHA, e.g. `.../gantry-v2-shared.4d21793112932f67.min.js?cacheKey=...`
 * (older builds used `gantry-shared.<sha>`). A log bundle can span up to two
 * weeks, during which the webapp may reload onto newer builds, so a single
 * bundle can name more than one SHA.
 */

// Matches the SHA in any gantry shared-chunk filename: `gantry-shared.<sha>`,
// `gantry-v2-shared.<sha>`, `gantry-v2-...-shared-....<sha>`, etc.
const GANTRY_SHA_RGX = /gantry-[a-z0-9-]*\.([0-9a-f]{6,40})\.min\.js/;

/** A distinct webapp build, bracketed by the first/last time it was seen. */
export interface WebappBuild {
  sha: string;
  /** momentValue (epoch ms) of the earliest line naming this build; 0 if undated. */
  firstSeen: number;
  /** momentValue (epoch ms) of the latest line naming this build; 0 if undated. */
  lastSeen: number;
}

/**
 * Extracts the gantry build SHA from a log line, or `null` if it names none.
 * Guards on the `gantry-` substring so it is cheap on every line.
 */
export function extractWebappBuildSha(line: string): string | null {
  if (!line.includes('gantry-')) {
    return null;
  }
  const match = GANTRY_SHA_RGX.exec(line);
  return match ? match[1] : null;
}

/**
 * Records a build SHA seen at `momentValue` in `acc`, widening its
 * first/last-seen window. A `momentValue` of 0 (undated line) records the
 * build without pulling a real window bound down to 0. Mutates and returns
 * `acc`.
 */
export function accumulateWebappBuild(
  acc: Record<string, WebappBuild>,
  sha: string,
  momentValue: number,
): Record<string, WebappBuild> {
  const existing = acc[sha];
  if (!existing) {
    acc[sha] = { sha, firstSeen: momentValue, lastSeen: momentValue };
    return acc;
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

/**
 * Merges per-file build maps into one deduped list sorted newest-last-seen
 * first, unioning the first/last-seen window of builds sharing a SHA.
 */
export function mergeWebappBuilds(
  maps: Array<Record<string, WebappBuild> | undefined>,
): Array<WebappBuild> {
  const merged: Record<string, WebappBuild> = {};

  for (const map of maps) {
    if (!map) {
      continue;
    }
    for (const build of Object.values(map)) {
      const existing = merged[build.sha];
      if (!existing) {
        merged[build.sha] = { ...build };
        continue;
      }
      const firsts = [existing.firstSeen, build.firstSeen].filter((n) => n > 0);
      existing.firstSeen = firsts.length ? Math.min(...firsts) : 0;
      existing.lastSeen = Math.max(existing.lastSeen, build.lastSeen);
    }
  }

  return Object.values(merged).sort((a, b) => b.lastSeen - a.lastSeen);
}
