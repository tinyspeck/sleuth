import { TZDate } from '@date-fns/tz';

/**
 * Takes a date generated without TZ data and returns its equivalent timezone in
 * a given TZ.
 *
 * @example
 * ```ts
 * // This will be 2025-10-31T03:10:48.153Z
 * getTZDateFromString('2025-10-30T20:10:48.153', 'America/Vancouver');
 * ```
 */
export function getTZDateFromString(dateString: string, tz?: string): Date {
  const parsedDate = new Date(dateString);
  const tzDate = new TZDate(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    parsedDate.getHours(),
    parsedDate.getMinutes(),
    parsedDate.getSeconds(),
    parsedDate.getMilliseconds(),
    tz,
  );

  return tzDate;
}
