import React from 'react';
import { observer } from 'mobx-react';

import {
  Button,
  Card,
  Descriptions,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { SleuthState } from '../state/sleuth';
import { autorun, IReactionDisposer } from 'mobx';
import { UnzippedFile } from '../../interfaces';
import { TraceThreadDescription, TraceProcessor } from '../processor/trace';
import autoBind from 'react-autobind';
import debug from 'debug';
import { AreaChartOutlined } from '@ant-design/icons';

export interface DevtoolsViewProps {
  state: SleuthState;
  file: UnzippedFile;
}

export interface DevtoolsViewState {
  profilePid?: number;
  profileType?: TraceThreadDescription['type'];
}

const d = debug('sleuth:devtoolsview');

@observer
export class DevtoolsView extends React.Component<
  DevtoolsViewProps,
  DevtoolsViewState
> {
  private disposeDarkModeAutorun: IReactionDisposer | undefined;
  private processor: TraceProcessor;

  constructor(props: DevtoolsViewProps) {
    super(props);
    this.processor = new TraceProcessor(this.props.file);
    autoBind(this);
    this.state = {};
    this.prepare();
  }

  async prepare() {
    const { state } = this.props;
    if (!state.traceThreads) {
      state.traceThreads = await this.processor.getProcesses();
    }
  }

  private renderThreads() {
    const { traceThreads } = this.props.state;
    const hasThreads = !!traceThreads?.length;
    const isLoading = !traceThreads;

    const startTime = parseInt(
      this.props.file.fileName.split('.')[0]?.split('_')[4] || '0',
      10,
    );
    const endTime = parseInt(
      this.props.file.fileName.split('.')[0]?.split('_')[0] || '0',
      10,
    );
    const duration = endTime - startTime;

    return (
      <Card className="ProcessTable">
        <Space direction="vertical">
          <Typography.Title level={3}>Performance Profile</Typography.Title>
          <Descriptions
            items={[
              {
                key: '1',
                label: 'Duration',
                children: (
                  <span>
                    {duration
                      ? Math.floor(duration / 1000).toString()
                      : 'unknown'}{' '}
                    seconds
                  </span>
                ),
              },
              {
                key: '2',
                label: 'Trace started',
                children: (
                  <span>
                    {startTime
                      ? new Date(startTime).toLocaleString()
                      : 'unknown'}
                  </span>
                ),
              },
              {
                key: '3',
                label: 'Trace ended',
                children: (
                  <span>
                    {endTime ? new Date(endTime).toLocaleString() : 'unknown'}
                  </span>
                ),
              },
            ]}
          />
          {isLoading && <Skeleton />}
          {!hasThreads && !isLoading ? (
            <p>No trace threads found...</p>
          ) : (
            <Table
              pagination={false}
              dataSource={traceThreads?.map((value, index) => ({
                key: index,
                process: value.title || 'Unknown',
                type: <Tag>{value.type}</Tag>,
                pid: value.processId,
                open: (
                  <Button
                    onClick={() =>
                      this.setState({
                        profilePid: value.processId,
                        profileType: value.type,
                      })
                    }
                    icon={<AreaChartOutlined />}
                  >
                    Open
                  </Button>
                ),
              }))}
              columns={[
                { title: 'Process Name', dataIndex: 'process', key: 'process' },
                { title: 'Type', dataIndex: 'type', key: 'type' },
                { title: 'PID', dataIndex: 'pid', key: 'pid' },
                { title: 'Action', dataIndex: 'open', key: 'open' },
              ]}
            />
          )}
        </Space>
      </Card>
    );
  }

  public render() {
    if (this.state.profilePid) {
      return (
        <div className="Devtools">
          <iframe
            title="DevTools embed"
            src={`oop://oop/devtools-frontend.html?panel=timeline`}
            onLoad={() => this.loadFile(this.state.profilePid)}
            frameBorder={0}
          />
        </div>
      );
    }
    return <div className="ProcessTableWrapper">{this.renderThreads()}</div>;
  }

  public componentWillUnmount() {
    if (this.disposeDarkModeAutorun) {
      this.disposeDarkModeAutorun();
    }
  }

  /**
   * Loads the currently selected file in catapult
   *
   * @memberof NetLogView
   */
  public async loadFile(processId?: number) {
    const isDarkMode = this.props.state.prefersDarkColors;
    this.setDarkMode(isDarkMode);

    if (!processId) {
      return;
    }

    d(`iFrame loaded`);
    const iframe = document.querySelector('iframe');

    if (iframe) {
      const events = await this.processor.getRendererProfile(processId);

      // See catapult.html for the postMessage handler
      const devtoolsWindow = iframe.contentWindow;
      devtoolsWindow?.postMessage(
        {
          instruction: 'load',
          payload: { events },
        },
        'oop://oop/devtools-frontend.html',
      );
    }

    this.disposeDarkModeAutorun = autorun(() => {
      const isDarkMode = this.props.state.prefersDarkColors;
      this.setDarkMode(isDarkMode);
    });
  }

  /**
   * We have a little bit of css in catapult.html that'll enable a
   * basic dark mode.
   *
   * @param {boolean} enabled
   * @memberof NetLogView
   */
  public setDarkMode(enabled: boolean) {
    try {
      const iframe = document.getElementsByTagName('iframe');

      if (iframe && iframe.length > 0) {
        const devtoolsWindow = iframe[0].contentWindow;

        //custom protocol :// *
        devtoolsWindow?.postMessage(
          {
            instruction: 'dark-mode',
            payload: enabled,
          },
          'oop://oop/devtools-frontend.html',
        );
      }
    } catch (error) {
      d(`Failed to set dark mode`, error);
    }
  }
}
