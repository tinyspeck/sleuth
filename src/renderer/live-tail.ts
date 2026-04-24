import { runInAction } from 'mobx';

import {
  LiveTailUpdatePayload,
  LogEntry,
  LogType,
  MergedLogFile,
  ProcessedLogFile,
  SelectableLogType,
} from '../interfaces';
import { SleuthState } from './state/sleuth';

export function applyLiveTailUpdate(
  state: SleuthState,
  payload: LiveTailUpdatePayload,
): void {
  if (!state.processedLogFiles || !state.mergedLogFiles) return;

  runInAction(() => {
    const affectedTypes = new Set<SelectableLogType>();
    const newEntriesByType = new Map<SelectableLogType, LogEntry[]>();

    for (const update of payload.updates) {
      if (update.newEntries.length === 0) continue;

      const processed = findProcessedFile(state, update.fileId);
      if (!processed) continue;

      processed.logEntries.push(...update.newEntries);

      for (const entry of update.newEntries) {
        if (entry.tag?.name) {
          const prev = state.liveTailTagCounts.get(entry.tag.name) ?? 0;
          state.liveTailTagCounts.set(entry.tag.name, prev + 1);
        }
      }

      for (const [level, delta] of Object.entries(update.levelCountDeltas)) {
        processed.levelCounts[level] =
          (processed.levelCounts[level] || 0) + delta;
      }
      for (const [msg, delta] of Object.entries(update.repeatedCountDeltas)) {
        processed.repeatedCounts[msg] =
          (processed.repeatedCounts[msg] || 0) + delta;
      }

      affectedTypes.add(processed.logType);
      affectedTypes.add(LogType.ALL);

      const existing = newEntriesByType.get(processed.logType) ?? [];
      existing.push(...update.newEntries);
      newEntriesByType.set(processed.logType, existing);
    }

    for (const logType of affectedTypes) {
      if (logType === LogType.ALL) continue;

      const existingMerged = state.mergedLogFiles![logType];
      if (!existingMerged) continue;

      const batchEntries = newEntriesByType.get(logType) ?? [];
      existingMerged.logEntries.push(...batchEntries);
      state.updateLiveTailFile({ ...existingMerged });
    }

    if (affectedTypes.has(LogType.ALL)) {
      const allMerged = state.mergedLogFiles![LogType.ALL];
      if (allMerged) {
        const allNewEntries: LogEntry[] = [];
        for (const entries of newEntriesByType.values()) {
          allNewEntries.push(...entries);
        }
        allNewEntries.sort(
          (a, b) => (a.momentValue ?? 0) - (b.momentValue ?? 0),
        );

        allMerged.logEntries.push(...allNewEntries);
        state.updateLiveTailFile({ ...allMerged });
      }
    }
  });
}

function findProcessedFile(
  state: SleuthState,
  fileId: string,
): ProcessedLogFile | undefined {
  if (!state.processedLogFiles) return undefined;

  for (const files of Object.values(state.processedLogFiles)) {
    if (!Array.isArray(files)) continue;
    for (const file of files) {
      if (
        'logEntries' in file &&
        (file as ProcessedLogFile).logFile.fullPath === fileId
      ) {
        return file as ProcessedLogFile;
      }
    }
  }

  return undefined;
}
