/**
 * Something like `[HUDDLES]` in webapp logs
 */
const WEBAPP_TAG_RGX = /^\s*\[([A-Za-z][A-Za-z0-9_ -]+)\]/;
/**
 * Something like `Store:` in desktop logs
 */
const BROWSER_PREFIX_RGX = /^\s*([A-Za-z][A-Za-z0-9_-]*(?:\s*\[[^\]]+\])?):/;
/**
 * Something like `Tag = fooBarEpic;` for rxjs-spy debug logs
 */
const BROWSER_EPIC_TAG_PREFIX = /^\s*Tag = ([A-Za-z][A-Za-z0-9_]*);/;

export function matchTag(msg: string): RegExpExecArray | null {
  return (
    WEBAPP_TAG_RGX.exec(msg) ||
    BROWSER_PREFIX_RGX.exec(msg) ||
    BROWSER_EPIC_TAG_PREFIX.exec(msg)
  );
}

const tagColorCache = new Map<string, string>();

/**
 * Maps a tag string to an HSL color hex code, varying by dark/light theme.
 */
export function hashTagColor(tag: string, dark: boolean): string {
  const key = `${dark ? 'd' : 'l'}:${tag}`;
  const cached = tagColorCache.get(key);
  if (cached) return cached;

  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = ((hash % 360) + 360) % 360;
  // Yellow-green (40–160) needs lower lightness for contrast on white backgrounds
  // Blue-purple (220–310) needs higher lightness for contrast on dark backgrounds
  const l = dark
    ? h >= 220 && h < 310
      ? 78
      : 65
    : h >= 40 && h < 160
      ? 32
      : 45;
  const s = dark && h >= 220 && h < 310 ? 95 : 80;
  const color = `hsl(${h}, ${s}%, ${l}%)`;
  tagColorCache.set(key, color);
  return color;
}
