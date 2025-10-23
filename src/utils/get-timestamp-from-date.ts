import { tzOffset, TZDate } from '@date-fns/tz';

/**
 * Helper to get the epoch timestamp from a date string that may have a timezone.
 *
 * `log-context.json` specifies an IANA timezone for the user's system. This function should
 * be used to convert the user's log timestamp into an accurate UNIX epoch timestamp
 * for sorting and display.
 *
 * @param dateString A raw date string (not normalized to UTC)
 * @param timezone The IANA time zone that the date string is in (optional)
 */
export const getEpochFromDateString = (
  dateString: string,
  timezone?: string,
): number => {
  let momentValue: number;
  if (timezone) {
    const offset = getUTCOffsetForTZ(timezone);
    momentValue = new Date(`${dateString}${offset}`).valueOf();
  } else {
    momentValue = new Date(dateString).valueOf();
  }
  return momentValue;
};

/**
 * Takes an IANA timezone string and returns the UTC offset in ±HH:MM format.
 * @param timezone An IANA timezone string
 * @returns The UTC offset in ±HH:MM format
 */
export const getUTCOffsetForTZ = (timezone: string) => {
  const offsetInMinutes = tzOffset(
    timezone,
    // the date in particular doesn't matter here
    new TZDate('2025-01-01', timezone),
  );

  const offsetHours = Math.floor(Math.abs(offsetInMinutes) / 60);
  const offsetMinutes = Math.abs(offsetInMinutes) % 60;
  const offsetDirection = offsetInMinutes < 0 ? '-' : '+';
  return `${offsetDirection}${String(offsetHours).padStart(2, '0')}:${String(
    offsetMinutes,
  ).padStart(2, '0')}`;
};
