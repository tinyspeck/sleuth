import {
  ProcessorPerformanceInfo,
  SelectableLogType,
  LogType,
  LOG_TYPES_TO_PROCESS,
} from '../../interfaces';

let logBuffer: Array<ProcessorPerformanceInfo> = [];

export function logPerformance(input: ProcessorPerformanceInfo) {
  logBuffer.push({
    ...input,
    processingTime: Math.round(input.processingTime),
  });
}

export function combineResultsForType(
  type: SelectableLogType,
): ProcessorPerformanceInfo {
  return logBuffer.reduce(
    (prev, curr) => {
      if (type !== LogType.ALL && curr.type !== type) return prev;

      return {
        ...prev,
        entries: prev.entries + curr.entries,
        lines: prev.lines + curr.lines,
        processingTime: prev.processingTime + curr.processingTime,
      };
    },
    {
      entries: 0,
      lines: 0,
      processingTime: 0,
      name: `All ${type} logs`,
      type,
    },
  );
}

export function flushLogPerformance() {
  const summary: Array<ProcessorPerformanceInfo> = [];

  for (const logType of LOG_TYPES_TO_PROCESS) {
    summary.push(combineResultsForType(logType));
  }

  console.table(logBuffer);
  console.table(summary);
  logBuffer = [];
}
