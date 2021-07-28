import { SleuthState } from '../state/sleuth';
import { observer } from 'mobx-react';
import React from 'react';
import { ChartJSChart, InteractionItem } from './chart-js';
import { parse } from 'date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import { isLogFile } from '../../utils/is-logfile';
import { LogLevel, LogMetrics } from '../../interfaces';
import autoBind from 'react-autobind';

export interface LogTimeViewProps {
  state: SleuthState;
  isVisible: boolean;
  height: number;
}

@observer
export class LogTimeView extends React.Component<LogTimeViewProps> {
  constructor(props: LogTimeViewProps) {
    super(props);
    autoBind(this);
  }

  private onChartClick(chartElements: Array<InteractionItem>) {
    if (!chartElements || !chartElements.length) return;

    const [first] = chartElements;
    const {element}: {element: any} = first;
    const chart = element.$context.chart;

    const canvasPosition = element.getCenterPoint();

    const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);

      const { selectedLogFile } = this.props.state;
      if (isLogFile(selectedLogFile)) {
        const { logEntries } = selectedLogFile;
        const selectedEntry = logEntries.find((entry) => {
          return parse(entry.timestamp, 'MM/dd/yy, HH:mm:ss:SSS', new Date()) >= dataX;
        });
        this.props.state.selectedEntry = selectedEntry;
      }
  }

  private onZoomComplete({ chart }: any) {
    const from = chart.scales.x.min;
    const until = chart.scales.x.max;
    this.props.state.customTimeViewRange = until - from;
  }

  public render(): JSX.Element | null {
    const { selectedLogFile } = this.props.state;
    if (!this.props.isVisible || !selectedLogFile || !isLogFile(selectedLogFile)) return null;


    const backgroundColors = {
      [LogLevel.info]: '#7FD1E0',
      [LogLevel.warn]: '#F8B82C',
      [LogLevel.error]: '#E32072',
      [LogLevel.debug]: ''
    };

    let datasets: Array<any> = [];
    const { timeBucketedLogMetrics } = this.props.state;
    if (timeBucketedLogMetrics) {
      const buckedLogMetricsByTime = Object.entries<LogMetrics>(timeBucketedLogMetrics);
      datasets = Object.keys(LogLevel).map((type) => {
        return {
          label: type,
          data: buckedLogMetricsByTime.map(([time, buckets]) => ({
            y: buckets[type],
            x: new Date(parseInt(time, 10) * 1000),
          })),
          backgroundColor: backgroundColors[type]
        };
      });
    }

    return (
      <div style={{ position: 'relative', height: this.props.height }}>
        <ChartJSChart
          key={selectedLogFile.id}
          type='bar'
          data={{
            datasets
          } as any}
          options={
            {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  stacked: true,
                  type: 'time',
                  time: {
                    unit: 'hour',
                  },
                  ticks: {
                    autoSkip: false,
                    maxRotation: 0,
                    major: {
                      enabled: true
                    },
                  }
                },
                y: {
                  stacked: true,
                },
              },
              plugins: {
                zoom: {
                  pan: {
                    enabled: true,
                    mode: 'x',
                  },
                  zoom: {
                    mode: 'x',
                    wheel: {
                      enabled: true,
                    },
                    onZoomComplete: this.onZoomComplete,
                  },
                },
              }
            }
          }
          plugins={[zoomPlugin]}
          getElementAtEvent={this.onChartClick}
        />
      </div>
    );
  }
}
