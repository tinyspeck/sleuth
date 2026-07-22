// Match ONLY the primary shared bundle. Its content hash is the build
// identity (what root-state records as the webapp version); async route
// chunks (`gantry-v2-async-...`) each carry their own hash, so matching them
// would report hundreds of "builds" per bundle. The leading boundary excludes
// those. Older builds used `gantry-shared`, newer ones `gantry-v2-shared`.
const GANTRY_SHA_RGX =
  /(?:^|[\s/])gantry(?:-v\d+)?-shared\.([0-9a-f]{6,40})\.min\.js/;

export interface WebappBuild {
  sha: string;
  /** momentValue (epoch ms); 0 if only seen on undated lines. */
  firstSeen: number;
  lastSeen: number;
}

export function extractWebappBuildSha(line: string): string | null {
  // Cheap guard so we skip the regex on the vast majority of lines.
  if (!line.includes('gantry-')) {
    return null;
  }
  const match = GANTRY_SHA_RGX.exec(line);
  return match ? match[1] : null;
}

/**
 * A `momentValue` of 0 (undated line) records the build without pulling a real
 * window bound down to 0. Mutates and returns `acc`.
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
