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
