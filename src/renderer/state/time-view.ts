import {
  getUnixTime,
  startOfMinute,
  getMinutes,
  add,
  set,
  startOfHour,
} from 'date-fns';
import { isLogFile } from '../../utils/is-logfile';
import { TimeBucketedLogMetrics, SelectableLogFile } from '../../interfaces';

function getBucket(range: number, momentValue: number): number {
  if (range < 1000 * 60 * 60 * 4) {
    return getUnixTime(startOfMinute(momentValue));
  } else if (range < 1000 * 60 * 60 * 8) {
    const r = 30 - (getMinutes(momentValue) % 15);
    return getUnixTime(
      set(add(momentValue, { minutes: r }), { seconds: 0, milliseconds: 0 }),
    );
  } else if (range < 1000 * 60 * 60 * 24) {
    const r = 30 - (getMinutes(momentValue) % 30);
    return getUnixTime(
      set(add(momentValue, { minutes: r }), { seconds: 0, milliseconds: 0 }),
    );
  }
  return getUnixTime(startOfHour(momentValue));
}

/**
 * Get bucketed log events from the selected log file. Buckets are determined by the viewing range
 *
 * @export
 * @param {SleuthState} state
 * @returns {TimeBucketedLogMetrics} timeBucketedLogMetrics
 */
export function getTimeBucketedLogMetrics(
  selectedLogFile: SelectableLogFile,
  range: number,
): TimeBucketedLogMetrics {
  if (!isLogFile(selectedLogFile)) {
    return {};
  }

  const values: TimeBucketedLogMetrics = {};
  for (const entry of selectedLogFile.logEntries) {
    if (entry.momentValue) {
      const bucket = getBucket(range, entry.momentValue);
      values[bucket] = values[bucket] || {
        info: 0,
        warn: 0,
        error: 0,
        debug: 0,
      };
      values[bucket][entry.level]++;
    }
  }

  return values;
}

/**
 * Get initial range (difference between highest and lowest timestamp) from the selected log file
 */
export function getInitialTimeViewRange(
  selectedLogFile: SelectableLogFile,
): number {
  if (!isLogFile(selectedLogFile) || selectedLogFile.logEntries.length === 0) {
    return 0;
  }

  let min = Number.MAX_SAFE_INTEGER;
  let max = 0;
  for (const { momentValue } of selectedLogFile.logEntries) {
    if (!momentValue) continue;

    if (momentValue < min) {
      min = momentValue;
    }

    if (momentValue > max) {
      max = momentValue;
    }
  }
  return max - min;
}
