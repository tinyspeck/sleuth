// Webapp builds are identified from the `[VERSION]` block the client logs on
// each boot — the same data `/slackversion` reports:
//
//   [VERSION] version_hash: 1ae9268c6546cd002c66bea39720f4cebfbfd1d9
//   [VERSION] version_ts: 1781553767
//
// version_hash is the git SHA (the build identity, also stored in root-state as
// `sha@ts`); version_ts is the build timestamp (epoch seconds). The two fields
// are logged on adjacent lines, so the caller pairs a version_ts with the most
// recent version_hash. (Older/newer clients may name the timestamp field
// `build_version_ts`; both are accepted.)
const VERSION_HASH_RGX = /\[VERSION\] version_hash: ([0-9a-f]{6,40})/;
const VERSION_TS_RGX = /\[VERSION\] (?:build_version_ts|version_ts): (\d+)/;

export interface WebappBuild {
  /** git version_hash. */
  sha: string;
  /** version_ts build timestamp, epoch seconds; 0 if not seen. */
  buildTs: number;
  /** observed momentValue (epoch ms) — when the build was running; 0 if undated. */
  firstSeen: number;
  lastSeen: number;
}

export type VersionField = { hash: string } | { ts: number };

export function extractVersionField(line: string): VersionField | null {
  // Cheap guard so we skip the regexes on the vast majority of lines.
  if (!line.includes('[VERSION]')) {
    return null;
  }
  const hash = VERSION_HASH_RGX.exec(line);
  if (hash) {
    return { hash: hash[1] };
  }
  const ts = VERSION_TS_RGX.exec(line);
  if (ts) {
    return { ts: Number(ts[1]) };
  }
  return null;
}

/**
 * Records a build (keyed by SHA) with its build timestamp and observed time.
 * A `momentValue` of 0 (undated line) records the build without pulling a real
 * observed-window bound down to 0. Mutates and returns `acc`.
 */
export function accumulateWebappBuild(
  acc: Record<string, WebappBuild>,
  sha: string,
  buildTs: number,
  momentValue: number,
): Record<string, WebappBuild> {
  const existing = acc[sha];
  if (!existing) {
    acc[sha] = { sha, buildTs, firstSeen: momentValue, lastSeen: momentValue };
    return acc;
  }
  if (buildTs && !existing.buildTs) {
    existing.buildTs = buildTs;
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
 * Merges per-file build maps into one deduped list, newest build first (by
 * build timestamp, then observed time), unioning the data of builds sharing a
 * SHA.
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
      if (build.buildTs && !existing.buildTs) {
        existing.buildTs = build.buildTs;
      }
      const firsts = [existing.firstSeen, build.firstSeen].filter((n) => n > 0);
      existing.firstSeen = firsts.length ? Math.min(...firsts) : 0;
      existing.lastSeen = Math.max(existing.lastSeen, build.lastSeen);
    }
  }

  return Object.values(merged).sort(
    (a, b) => b.buildTs - a.buildTs || b.lastSeen - a.lastSeen,
  );
}
