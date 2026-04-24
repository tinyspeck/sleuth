import { runInAction } from 'mobx';

import {
  LiveTailUpdatePayload,
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

    for (const update of payload.updates) {
      if (update.newEntries.length === 0) continue;

      const processed = findProcessedFile(state, update.fileId);
      if (!processed) {
        console.log('[live-tail apply] No match for fileId:', update.fileId);
        continue;
      }

      console.log(
        '[live-tail apply] Matched %s, appending %d entries (total: %d)',
        update.fileId,
        update.newEntries.length,
        processed.logEntries.length + update.newEntries.length,
      );
      processed.logEntries.push(...update.newEntries);

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
    }

    for (const logType of affectedTypes) {
      if (logType === LogType.ALL) continue;

      const existingMerged = state.mergedLogFiles![logType];
      if (!existingMerged) continue;

      const updatedMerged = rebuildMerged(existingMerged);
      state.updateLiveTailFile(updatedMerged);
    }

    if (affectedTypes.has(LogType.ALL)) {
      const allMerged = state.mergedLogFiles![LogType.ALL];
      if (allMerged) {
        const freshSources = allMerged.logFiles.map(
          (f) =>
            ('logType' in f &&
              state.mergedLogFiles![f.logType as SelectableLogType]) ||
            f,
        );
        const allEntries = freshSources.flatMap((f) => f.logEntries);
        allEntries.sort((a, b) => (a.momentValue ?? 0) - (b.momentValue ?? 0));
        state.updateLiveTailFile({
          ...allMerged,
          logFiles: freshSources as ProcessedLogFile[],
          logEntries: allEntries,
        });
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

function rebuildMerged(existing: MergedLogFile): MergedLogFile {
  const allEntries = existing.logFiles.flatMap((f) => f.logEntries);
  allEntries.sort((a, b) => (a.momentValue ?? 0) - (b.momentValue ?? 0));

  return {
    ...existing,
    logEntries: allEntries,
  };
}
