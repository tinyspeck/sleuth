import { describe, it, expect } from 'vitest';
import { TZDate } from '@date-fns/tz';

import { getTZDateFromString } from '../../src/utils/get-tz-date-from-string';

describe('getTZDateFromString', () => {
  it('should convert a date string to a TZDate in PDT', () => {
    const dateString = '2025-10-30T20:10:48.153';
    const result = getTZDateFromString(dateString, 'America/Vancouver');

    expect(result).toBeInstanceOf(TZDate);
    // Vancouver is UTC-7 in October, so 20:10:48.153 Vancouver time
    // should be 03:10:48.153 UTC the next day
    expect(result.valueOf()).toBe(
      new Date('2025-10-31T03:10:48.153Z').valueOf(),
    );
  });

  it('should convert a date string to a TZDate in PST', () => {
    const dateString = '2025-01-30T20:10:48.153';
    const result = getTZDateFromString(dateString, 'America/Vancouver');

    expect(result).toBeInstanceOf(TZDate);
    // Vancouver is UTC-8 in January, so 20:10:48.153 Vancouver time
    // should be 04:10:48.153 UTC the next day
    expect(result.valueOf()).toBe(
      new Date('2025-01-31T04:10:48.153Z').valueOf(),
    );
  });

  it('should handle timezone without milliseconds', () => {
    const dateString = '2025-10-30T20:10:48';
    const result = getTZDateFromString(dateString, 'America/Vancouver');

    expect(result).toBeInstanceOf(TZDate);
    expect(result.valueOf()).toBe(
      new Date('2025-10-31T03:10:48.000Z').valueOf(),
    );
  });

  it('should handle date string without timezone parameter', () => {
    const dateString = '2025-10-30T20:10:48.153';
    const result = getTZDateFromString(dateString);

    expect(result.toDateString()).toEqual(new Date(dateString).toDateString());
  });

  it('should preserve all date components (year, month, day, hours, minutes, seconds, milliseconds)', () => {
    const dateString = '2024-12-25T15:30:45.999';
    const result = getTZDateFromString(dateString, 'UTC');

    expect(result).toBeInstanceOf(TZDate);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(11); // December is month 11 (0-indexed)
    expect(result.getDate()).toBe(25);
    expect(result.getUTCHours()).toBe(15);
    expect(result.getUTCMinutes()).toBe(30);
    expect(result.getUTCSeconds()).toBe(45);
    expect(result.getUTCMilliseconds()).toBe(999);
  });

  it('should handle timezone with positive UTC offset (Asia/Tokyo)', () => {
    const dateString = '2025-10-30T20:10:48.153';
    const result = getTZDateFromString(dateString, 'Asia/Tokyo');

    expect(result).toBeInstanceOf(TZDate);
    // Tokyo is UTC+9, so 20:10:48.153 JST should be 11:10:48.153 UTC same day
    expect(result.valueOf()).toBe(
      new Date('2025-10-30T11:10:48.153Z').valueOf(),
    );
  });
});
