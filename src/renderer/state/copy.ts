import { clipboard } from 'electron';
import { SleuthState } from './sleuth';
import { LogEntry } from '../../interfaces';
import { format } from 'date-fns';

/**
 * Performs a copy operation. Returns true if it did something,
 * false if it didn't.
 *
 * @export
 * @param {SleuthState} state
 * @returns {boolean}
 */
export function copy(state: SleuthState): boolean {
  const { selectedRangeEntries, selectedEntry, isSmartCopy } = state;
  const hasSelection = !!window.getSelection()?.toString();
  const hasEntries = selectedRangeEntries && selectedRangeEntries?.length > 1;
  const shouldCopy = !hasSelection && isSmartCopy;

  if (shouldCopy && hasEntries) {
    clipboard.writeText(selectedRangeEntries!.map(getCopyText).join('\n'));
    return true;
  } else if (shouldCopy && selectedEntry) {
    clipboard.writeText(getCopyText(selectedEntry));
    return true;
  }

  return false;
}

function getCopyText(entry: LogEntry) {
  const { message, meta } = entry;
  let { timestamp } = entry;

  // Android log timestamps look like this: Thu Jul 15 2021 13:14:58 GMT-0700 (Pacific Daylight Time)
  // Might as well reformat all timestamps to be consistent with m/dd/yy, hh:mm:ss
  timestamp = format(new Date(timestamp), 'M/dd/yy, HH:mm:ss');

  let text = `${timestamp} ${message}`;

  if (meta) {
    text += `\n${meta}`;
  }

  return text;
}
