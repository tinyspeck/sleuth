import { SleuthState } from '../state/sleuth';
import { observer } from 'mobx-react';
import React, { useCallback } from 'react';
import { Column } from '@ant-design/charts';
import type { ColumnConfig } from '@ant-design/charts';
import { isLogFile } from '../../utils/is-logfile';
import { LogLevel, LogMetrics } from '../../interfaces';
import classNames from 'classnames';

export interface LogTimeViewProps {
  state: SleuthState;
}

interface TimeDataPoint {
  time: string;
  epoch: number;
  count: number;
  level: string;
}

const LEVEL_COLORS: Record<string, string> = {
  [LogLevel.info]: '#7FD1E0',
  [LogLevel.warn]: '#F8B82C',
  [LogLevel.error]: '#E32072',
  [LogLevel.debug]: '#8C8C8C',
};

const LEVEL_ORDER = [
  LogLevel.debug,
  LogLevel.info,
  LogLevel.warn,
  LogLevel.error,
];

export const LogTimeView = observer((props: LogTimeViewProps) => {
  const { selectedFile, isLogViewVisible, isUserTZ } = props.state;

  const onElementClick = useCallback(
    (_ev: Event, datum: { data: TimeDataPoint }) => {
      if (!datum?.data?.epoch) return;
      const clickedTime = datum.data.epoch;

      const { selectedFile } = props.state;
      if (isLogFile(selectedFile)) {
        const { logEntries } = selectedFile;
        const selectedEntry = logEntries.find(
          (entry) => (entry.momentValue || 0) >= clickedTime,
        );
        props.state.selectedEntry = selectedEntry;
      }
    },
    [props.state],
  );

  const { timeBucketedLogMetrics, dateRange } = props.state;
  const fromTs = dateRange.from ? dateRange.from.getTime() : null;
  const toTs = dateRange.to ? dateRange.to.getTime() : null;

  let data: TimeDataPoint[] = [];
  if (timeBucketedLogMetrics) {
    const bucketedLogMetricsByTime = Object.entries<LogMetrics>(
      timeBucketedLogMetrics,
    );
    const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const userTZ = props.state.stateFiles['log-context.json']?.data?.systemTZ;
    const tz = isUserTZ ? userTZ : systemTZ;

    for (const [time, buckets] of bucketedLogMetricsByTime) {
      const epoch = parseInt(time, 10) * 1000;
      if (fromTs !== null && epoch < fromTs) continue;
      if (toTs !== null && epoch > toTs) continue;
      const date = new Date(epoch);
      const dateString = date.toLocaleString('en-US', { timeZone: tz });

      for (const level of LEVEL_ORDER) {
        if (buckets[level] > 0) {
          data.push({
            time: dateString,
            epoch,
            count: buckets[level],
            level,
          });
        }
      }
    }
  }

  const epochByTime = new Map<string, number>();
  for (const d of data) {
    const existing = epochByTime.get(d.time);
    if (existing === undefined || d.epoch < existing) {
      epochByTime.set(d.time, d.epoch);
    }
  }

  const sortedEpochs = [...new Set(data.map((d) => d.epoch))].sort(
    (a, b) => a - b,
  );
  let bucketInterval = 0;
  for (let i = 1; i < sortedEpochs.length; i++) {
    const gap = sortedEpochs[i] - sortedEpochs[i - 1];
    if (bucketInterval === 0 || gap < bucketInterval) {
      bucketInterval = gap;
    }
  }

  if (!isLogViewVisible || !selectedFile || !isLogFile(selectedFile))
    return null;

  const className = classNames('Details', { IsVisible: isLogViewVisible });

  const config: ColumnConfig = {
    data,
    xField: 'time',
    yField: 'count',
    colorField: 'level',
    stack: true,
    theme: props.state.prefersDarkColors ? 'classicDark' : 'classic',
    scale: {
      color: {
        domain: LEVEL_ORDER,
        range: LEVEL_ORDER.map((l) => LEVEL_COLORS[l]),
      },
    },
    axis: {
      x: {
        labelAutoRotate: false,
        labelAutoHide: true,
        labelFormatter: (v: string) => v.split(',')[0],
      },
    },
    interaction: {
      brushXHighlight: true,
    },
    onReady: ({ chart }) => {
      chart.on('element:click', (ev: any) => {
        onElementClick(ev, ev.data);
      });
      chart.on('brush:end', (ev: any) => {
        const selection: [string[], unknown] | undefined = ev?.data?.selection;
        if (!selection) return;
        const [domainX] = selection;
        if (!domainX || domainX.length === 0) return;
        const epochs = domainX
          .map((t) => epochByTime.get(t))
          .filter((e): e is number => e !== undefined);
        if (epochs.length === 0) return;
        const minEpoch = Math.min(...epochs);
        const maxEpoch = Math.max(...epochs) + bucketInterval;
        props.state.dateRange = {
          from: new Date(minEpoch),
          to: new Date(maxEpoch),
        };
      });
      chart.on('brush:remove', () => {
        props.state.dateRange = { from: null, to: null };
      });
    },
  };

  return (
    <div className={className}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Column key={selectedFile.id} {...config} />
      </div>
    </div>
  );
});
