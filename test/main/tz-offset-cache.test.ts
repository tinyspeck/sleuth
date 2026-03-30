import { describe, it, expect, beforeEach } from 'vitest';
import { TZDate } from '@date-fns/tz';
import { toTZMillis, _resetTZCache } from '../../src/main/filesystem/read-file';

/**
 * Reference implementation: always constructs a TZDate (no caching).
 * Used to verify the cached path produces identical results.
 */
function referenceTZMillis(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  tz?: string,
): number {
  if (!tz) return Date.UTC(year, month, day, hour, minute, second, ms);
  return new TZDate(year, month, day, hour, minute, second, ms, tz).valueOf();
}

describe('toTZMillis cached offset correctness', () => {
  beforeEach(() => {
    _resetTZCache();
  });

  it('matches reference for a single timestamp (America/Los_Angeles)', () => {
    // 2024-06-15 10:30:45.123 — summer (PDT, UTC-7)
    const result = toTZMillis(
      2024,
      5,
      15,
      10,
      30,
      45,
      123,
      'America/Los_Angeles',
    );
    const expected = referenceTZMillis(
      2024,
      5,
      15,
      10,
      30,
      45,
      123,
      'America/Los_Angeles',
    );
    expect(result).toBe(expected);
  });

  it('matches reference for a single timestamp (Europe/London)', () => {
    // 2024-01-15 14:00:00.000 — winter (GMT, UTC+0)
    const result = toTZMillis(2024, 0, 15, 14, 0, 0, 0, 'Europe/London');
    const expected = referenceTZMillis(
      2024,
      0,
      15,
      14,
      0,
      0,
      0,
      'Europe/London',
    );
    expect(result).toBe(expected);
  });

  it('returns UTC when no timezone is provided', () => {
    const result = toTZMillis(2024, 5, 15, 10, 30, 45, 123);
    const expected = Date.UTC(2024, 5, 15, 10, 30, 45, 123);
    expect(result).toBe(expected);
  });

  it('matches reference for multiple timestamps on the same day (cache hit path)', () => {
    const tz = 'America/New_York';
    const times = [
      [2024, 6, 10, 8, 0, 0, 0],
      [2024, 6, 10, 8, 30, 0, 0],
      [2024, 6, 10, 12, 0, 0, 0],
      [2024, 6, 10, 18, 45, 30, 500],
      [2024, 6, 10, 23, 59, 59, 999],
    ] as const;

    for (const [year, month, day, hour, minute, second, ms] of times) {
      const result = toTZMillis(year, month, day, hour, minute, second, ms, tz);
      const expected = referenceTZMillis(
        year,
        month,
        day,
        hour,
        minute,
        second,
        ms,
        tz,
      );
      expect(result).toBe(expected);
    }
  });

  it('matches reference across different calendar days (cache miss path)', () => {
    const tz = 'Asia/Tokyo';
    const days = [
      [2024, 2, 14, 10, 0, 0, 0],
      [2024, 2, 15, 10, 0, 0, 0],
      [2024, 2, 16, 10, 0, 0, 0],
    ] as const;

    for (const [year, month, day, hour, minute, second, ms] of days) {
      const result = toTZMillis(year, month, day, hour, minute, second, ms, tz);
      const expected = referenceTZMillis(
        year,
        month,
        day,
        hour,
        minute,
        second,
        ms,
        tz,
      );
      expect(result).toBe(expected);
    }
  });

  it('matches reference across DST spring-forward boundary (different days)', () => {
    const tz = 'America/New_York';
    // 2024 spring forward: March 10, 2:00 AM -> 3:00 AM
    // Across different calendar days the cache revalidates, so offset is correct.
    const times = [
      // Day before DST (EST, UTC-5)
      [2024, 2, 9, 12, 0, 0, 0],
      // Day after DST (EDT, UTC-4)
      [2024, 2, 11, 12, 0, 0, 0],
      // Two days after
      [2024, 2, 12, 12, 0, 0, 0],
    ] as const;

    for (const [year, month, day, hour, minute, second, ms] of times) {
      const result = toTZMillis(year, month, day, hour, minute, second, ms, tz);
      const expected = referenceTZMillis(
        year,
        month,
        day,
        hour,
        minute,
        second,
        ms,
        tz,
      );
      expect(result).toBe(expected);
    }
  });

  it('has known ±1h imprecision for same-day DST transitions', () => {
    // The cache stores one offset per calendar date, so entries before and
    // after a 2 AM DST transition on the *same* day may be off by ±1h.
    // This test documents that known trade-off.
    const tz = 'America/New_York';
    // March 10, 2024: spring-forward at 2:00 AM (EST→EDT)
    _resetTZCache();
    // First call caches the EST offset for this date
    const beforeDST = toTZMillis(2024, 2, 10, 1, 0, 0, 0, tz);
    const beforeRef = referenceTZMillis(2024, 2, 10, 1, 0, 0, 0, tz);
    expect(beforeDST).toBe(beforeRef); // cache miss — exact

    // Second call on same date uses cached EST offset, but real offset is now EDT
    const afterDST = toTZMillis(2024, 2, 10, 3, 0, 0, 0, tz);
    const afterRef = referenceTZMillis(2024, 2, 10, 3, 0, 0, 0, tz);
    const errorMs = Math.abs(afterDST - afterRef);
    expect(errorMs).toBeLessThanOrEqual(3600000); // at most 1 hour off
  });

  it('matches reference across DST fall-back boundary (different days)', () => {
    const tz = 'America/Los_Angeles';
    // 2024 fall back: November 3, 2:00 AM -> 1:00 AM
    const times = [
      // Day before (PDT, UTC-7)
      [2024, 10, 2, 12, 0, 0, 0],
      // Day after (PST, UTC-8)
      [2024, 10, 4, 12, 0, 0, 0],
      // Two days after
      [2024, 10, 5, 12, 0, 0, 0],
    ] as const;

    for (const [year, month, day, hour, minute, second, ms] of times) {
      const result = toTZMillis(year, month, day, hour, minute, second, ms, tz);
      const expected = referenceTZMillis(
        year,
        month,
        day,
        hour,
        minute,
        second,
        ms,
        tz,
      );
      expect(result).toBe(expected);
    }
  });

  it('matches reference when switching between timezones', () => {
    const timezones = [
      'America/Los_Angeles',
      'America/New_York',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Australia/Sydney',
    ];

    for (const tz of timezones) {
      const result = toTZMillis(2024, 6, 15, 12, 0, 0, 0, tz);
      const expected = referenceTZMillis(2024, 6, 15, 12, 0, 0, 0, tz);
      expect(result).toBe(expected);
    }
  });

  it('matches reference for edge-of-day timestamps (midnight, end of day)', () => {
    const tz = 'Pacific/Auckland'; // UTC+12/+13
    const times = [
      [2024, 0, 1, 0, 0, 0, 0],
      [2024, 0, 1, 23, 59, 59, 999],
      [2024, 0, 2, 0, 0, 0, 0],
    ] as const;

    for (const [year, month, day, hour, minute, second, ms] of times) {
      const result = toTZMillis(year, month, day, hour, minute, second, ms, tz);
      const expected = referenceTZMillis(
        year,
        month,
        day,
        hour,
        minute,
        second,
        ms,
        tz,
      );
      expect(result).toBe(expected);
    }
  });

  it('matches reference for year boundary', () => {
    const tz = 'America/Chicago';
    const times = [
      [2023, 11, 31, 23, 59, 59, 999],
      [2024, 0, 1, 0, 0, 0, 0],
    ] as const;

    for (const [year, month, day, hour, minute, second, ms] of times) {
      const result = toTZMillis(year, month, day, hour, minute, second, ms, tz);
      const expected = referenceTZMillis(
        year,
        month,
        day,
        hour,
        minute,
        second,
        ms,
        tz,
      );
      expect(result).toBe(expected);
    }
  });

  it('cached result is identical to first (uncached) call for same date', () => {
    const tz = 'Europe/Berlin';
    // First call — cache miss
    const first = toTZMillis(2024, 3, 20, 9, 0, 0, 0, tz);
    // Second call — cache hit (same date, different time)
    const second = toTZMillis(2024, 3, 20, 15, 30, 0, 0, tz);

    const firstRef = referenceTZMillis(2024, 3, 20, 9, 0, 0, 0, tz);
    const secondRef = referenceTZMillis(2024, 3, 20, 15, 30, 0, 0, tz);

    expect(first).toBe(firstRef);
    expect(second).toBe(secondRef);
    // The offset applied should be the same for both (same date, no DST change)
    expect(second - first).toBe(secondRef - firstRef);
  });
});
