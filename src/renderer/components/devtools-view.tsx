import React from 'react';
import { observer } from 'mobx-react';

import { HTMLTable, Button, Card, Icon, ButtonGroup } from '@blueprintjs/core';
import { SleuthState } from '../state/sleuth';
import { autorun, IReactionDisposer } from 'mobx';
import { UnzippedFile } from '../../interfaces';
import { TraceThreadDescription, TraceProcessor } from '../processor/trace';
import autoBind from 'react-autobind';
import debug from 'debug';

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

  private rowRenderer({
    title,
    type,
    processId,
    isClient,
  }: TraceThreadDescription) {
    return (
      <tr key={processId}>
        <td>
          {isClient && <Icon icon="chat" />} {title || 'Unknown'}
        </td>
        <td>{processId}</td>
        <td>
          <ButtonGroup fill={true}>
            <Button
              onClick={() =>
                this.setState({ profilePid: processId, profileType: type })
              }
              icon={'document-open'}
            >
              Open
            </Button>
          </ButtonGroup>
        </td>
      </tr>
    );
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
      <Card>
        <h1>Threads</h1>
        <h4>
          Duration:{' '}
          {duration ? Math.floor(duration / 1000).toString() : 'unknown'}{' '}
          seconds | Trace started:{' '}
          {startTime ? new Date(startTime).toLocaleString() : 'unknown'} | Trace
          ended: {endTime ? new Date(endTime).toLocaleString() : 'unknown'}
        </h4>
        <h5>* Start & end times displayed in your local time</h5>
        <HTMLTable>
          <thead>
            <tr>
              <th>Name</th>
              <th>PID</th>
            </tr>
          </thead>
          <tbody>
            {hasThreads &&
              traceThreads?.map((thread) => this.rowRenderer(thread))}
            {!hasThreads && (
              <tr>
                <td colSpan={3}>No renderer threads found</td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={3}>Loading...</td>
              </tr>
            )}
          </tbody>
        </HTMLTable>
      </Card>
    );
  }

  public render() {
    if (this.state.profilePid) {
      return (
        <div className="Devtools">
          <iframe
            title="DevTools embed"
            src={`oop://oop/static/devtools-frontend.html?panel=timeline`}
            onLoad={() => this.loadFile(this.state.profilePid)}
            frameBorder={0}
          />
        </div>
      );
    }
    return <div className="ProcessTable">{this.renderThreads()}</div>;
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
        'oop://oop/static/devtools-frontend.html',
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
          'oop://oop/static/devtools-frontend.html',
        );
      }
    } catch (error) {
      d(`Failed to set dark mode`, error);
    }
  }
}
