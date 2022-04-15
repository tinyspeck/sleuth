import React from 'react';
import { observer } from 'mobx-react';

import {
  HTMLTable,
  Button,
  Card,
  Icon,
  ButtonGroup,
} from '@blueprintjs/core';
import { SleuthState } from '../state/sleuth';
import { autorun, IReactionDisposer } from 'mobx';
import { UnzippedFile } from '../../interfaces';
import { RendererDescription, TraceProcessor } from '../processor/trace';
import autoBind from 'react-autobind';

export interface DevtoolsViewProps {
  state: SleuthState;
  file: UnzippedFile;
}

export interface DevtoolsViewState {
  profilePid?: number;
}

const debug = require('debug')('sleuth:devtoolsview');

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
    if (!state.rendererThreads) {
      state.rendererThreads = await this.processor.getRendererProcesses();
    }
  }

  private rowRenderer({ title, processId, isClient }: RendererDescription) {
    return (
      <tr>
        <td>
          {isClient && <Icon icon='chat' />} {title || 'Unknown'}
        </td>
        <td>{processId}</td>
        <td>
          <ButtonGroup fill={true}>
            <Button
              onClick={() => this.setState({ profilePid: processId })}
              icon={'document-open'}
            >
              Open
            </Button>
          </ButtonGroup>
        </td>
      </tr>
    );
  }

  public render() {
    if (this.state.profilePid) {
      return (
        <div className='Devtools'>
          <iframe
            src={`oop://oop/static/devtools-frontend.html?panel=timeline`}
            onLoad={() => this.loadFile(this.state.profilePid)}
            frameBorder={0}
          />
        </div>
      );
    }

    const { rendererThreads } = this.props.state;
    const hasThreads = !!rendererThreads?.length;
    const missingThreads = rendererThreads?.length === 0;
    const isLoading = !rendererThreads;
    const startTime = parseInt(this.props.file.fileName.split('.')[0]?.split('_')[4] || '0', 10);
    const endTime = parseInt(this.props.file.fileName.split('.')[0]?.split('_')[0] || '0', 10);
    const duration = endTime - startTime;

    return (
      <div className='ProcessTable'>
        <Card>
          <h1>Renderer Threads</h1>
          <h4>Duration: {duration ? Math.floor(duration / 1000).toString() : 'unknown'} seconds
          {' '}| Trace started: {startTime ? new Date(startTime).toLocaleString() : 'unknown'}
          {' '}| Trace ended: {endTime ? new Date(endTime).toLocaleString() : 'unknown'}</h4>
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
                rendererThreads?.map((thread) =>
                  this.rowRenderer(thread)
                )}
              {missingThreads && (
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
      </div>
    );
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
    this.setDarkMode(this.props.state.isDarkMode);

    if (!processId) {
      return;
    }

    debug(`iFrame loaded`);
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
        'oop://oop/static/devtools-frontend.html'
      );
    }

    this.disposeDarkModeAutorun = autorun(() => {
      this.setDarkMode(this.props.state.isDarkMode);
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
          'oop://oop/static/devtools-frontend.html'
        );
      }
    } catch (error) {
      debug(`Failed to set dark mode`, error);
    }
  }
}
