import { SleuthState } from '../state/sleuth';
import { observer } from 'mobx-react';
import React from 'react';
import Chart, { InteractionItem } from 'chart.js/auto';
import { ChartJSChart } from './chart-js';
import { parse } from 'date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import { isLogFile } from '../../utils/is-logfile';
import { LogLevel, LogMetrics } from '../../interfaces';
import autoBind from 'react-autobind';
import classNames from 'classnames';

export interface LogTimeViewProps {
  state: SleuthState;
}

@observer
export class LogTimeView extends React.Component<LogTimeViewProps> {
  constructor(props: LogTimeViewProps) {
    super(props);
    autoBind(this);
  }

  private onChartClick(chartElements: Array<InteractionItem>) {
    if (!chartElements.length) return;

    const [first] = chartElements;
    const { element }: { element: any } = first;
    const chart = element.$context.chart;

    const canvasPosition = element.getCenterPoint();

    const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);

    const { selectedLogFile } = this.props.state;
    if (isLogFile(selectedLogFile)) {
      const { logEntries } = selectedLogFile;
      const selectedEntry = logEntries.find((entry) => {
        return (
          parse(entry.timestamp, 'MM/dd/yy, HH:mm:ss:SSS', new Date()) >= dataX
        );
      });
      this.props.state.selectedEntry = selectedEntry;
    }
  }

  private onZoomComplete({ chart }: { chart: Chart }) {
    const from = chart.scales.x.min;
    const until = chart.scales.x.max;
    this.props.state.customTimeViewRange = until - from;
  }

  public render(): JSX.Element | null {
    const { selectedLogFile, isLogViewVisible, isUserTZ } = this.props.state;
    if (!isLogViewVisible || !selectedLogFile || !isLogFile(selectedLogFile))
      return null;

    const className = classNames('Details', { IsVisible: isLogViewVisible });

    const backgroundColors = {
      [LogLevel.info]: '#7FD1E0',
      [LogLevel.warn]: '#F8B82C',
      [LogLevel.error]: '#E32072',
      [LogLevel.debug]: '',
    };
    let datasets: Array<any> = [];
    const { timeBucketedLogMetrics } = this.props.state;
    if (timeBucketedLogMetrics) {
      const bucketedLogMetricsByTime = Object.entries<LogMetrics>(
        timeBucketedLogMetrics,
      );
      const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const userTZ =
        this.props.state.stateFiles['log-context.json']?.data?.systemTZ;
      const tz = isUserTZ ? userTZ : systemTZ;
      datasets = Object.keys(LogLevel).map((type: LogLevel) => {
        return {
          label: type,
          data: bucketedLogMetricsByTime.map(([time, buckets]) => {
            const date = new Date(parseInt(time, 10) * 1000);
            const dateString = date.toLocaleString('en-US', { timeZone: tz });
            return {
              y: buckets[type],
              x: new Date(dateString),
            };
          }),
          backgroundColor: backgroundColors[type],
        };
      });
    }

    return (
      <div className={className}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <ChartJSChart
            key={selectedLogFile.id}
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
                    onZoomComplete: this.onZoomComplete,
                  },
                },
              },
            }}
            plugins={[zoomPlugin]}
            getElementAtEvent={this.onChartClick}
          />
        </div>
      </div>
    );
  }
}
