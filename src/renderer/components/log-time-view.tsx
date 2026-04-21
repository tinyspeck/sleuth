import { SleuthState } from '../state/sleuth';
import { observer } from 'mobx-react';
import React from 'react';
import Chart, { InteractionItem } from 'chart.js/auto';
import { ChartJSChart } from './chart-js';
import { parse } from 'date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import { isLogFile } from '../../utils/is-logfile';
import { LogLevel, LogMetrics } from '../../interfaces';
import classNames from 'classnames';

export interface LogTimeViewProps {
  state: SleuthState;
}

export const LogTimeView = observer((props: LogTimeViewProps) => {
  function onChartClick(chartElements: Array<InteractionItem>) {
    if (!chartElements.length) return;

    const [first] = chartElements;
    const { element }: { element: any } = first;
    const chart = element.$context.chart;

    const canvasPosition = element.getCenterPoint();

    const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);

    const { selectedFile } = props.state;
    if (isLogFile(selectedFile)) {
      const { logEntries } = selectedFile;
      const selectedEntry = logEntries.find((entry) => {
        return (
          parse(entry.timestamp, 'MM/dd/yy, HH:mm:ss:SSS', new Date()) >= dataX
        );
      });
      props.state.selectedEntry = selectedEntry;
    }
  }

  function onZoomComplete({ chart }: { chart: Chart }) {
    const from = chart.scales.x.min;
    const until = chart.scales.x.max;
    props.state.customTimeViewRange = until - from;
  }

  const { selectedFile, isLogViewVisible, isUserTZ } = props.state;
  if (!isLogViewVisible || !selectedFile || !isLogFile(selectedFile))
    return null;

  const className = classNames('Details', { IsVisible: isLogViewVisible });

  const backgroundColors = {
    [LogLevel.info]: '#7FD1E0',
    [LogLevel.warn]: '#F8B82C',
    [LogLevel.error]: '#E32072',
    [LogLevel.debug]: '',
  };
  let datasets: Array<any> = [];
  const { timeBucketedLogMetrics } = props.state;
  if (timeBucketedLogMetrics) {
    const bucketedLogMetricsByTime = Object.entries<LogMetrics>(
      timeBucketedLogMetrics,
    );
    const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const userTZ = props.state.stateFiles['log-context.json']?.data?.systemTZ;
    const tz = isUserTZ ? userTZ : systemTZ;
    datasets = Object.keys(LogLevel).map((type) => {
      return {
        label: type as LogLevel,
        data: bucketedLogMetricsByTime.map(([time, buckets]) => {
          const date = new Date(parseInt(time, 10) * 1000);
          const dateString = date.toLocaleString('en-US', { timeZone: tz });
          return {
            y: buckets[type as LogLevel],
            x: new Date(dateString),
          };
        }),
        backgroundColor: backgroundColors[type as LogLevel],
      };
    });
  }

  return (
    <div className={className}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <ChartJSChart
          key={selectedFile.id}
          type="bar"
          data={{
            datasets,
          }}
          options={{
            maintainAspectRatio: false,
            scales: {
              x: {
                stacked: true,
                type: 'time',
                time: {
                  unit: 'hour',
                },
                ticks: {
                  autoSkip: true,
                  maxRotation: 0,
                  major: {
                    enabled: true,
                  },
                },
              },
              y: {
                stacked: true,
              },
            },
            plugins: {
              zoom: {
                limits: {
                  x: {
                    min: 'original',
                    max: 'original',
                  },
                },
                pan: {
                  enabled: true,
                  mode: 'x',
                },
                zoom: {
                  mode: 'x',
                  wheel: {
                    enabled: true,
                    speed: 0.05,
                  },
                  drag: {
                    enabled: false,
                  },
                  pinch: {
                    enabled: false,
                  },
                  onZoomComplete,
                },
              },
            },
          }}
          plugins={[zoomPlugin]}
          getElementAtEvent={onChartClick}
        />
      </div>
    </div>
  );
});
