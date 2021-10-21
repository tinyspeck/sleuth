import React from 'react';
import { observer } from 'mobx-react';

import {
  Spinner,
  HTMLTable,
  Button,
  Card,
  Icon,
  ButtonGroup,
} from '@blueprintjs/core';
import { SleuthState } from '../state/sleuth';
import { autorun, IReactionDisposer } from 'mobx';
import { UnzippedFile } from '../../interfaces';
import { RendererDescription } from '../processor/trace';

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

  constructor(props: DevtoolsViewProps) {
    super(props);
    this.loadFile = this.loadFile.bind(this);
    this.state = {};
    this.prepare();
  }

  async prepare() {
    const { state, file } = this.props;
    if (!state.rendererThreads) {
      state.getRendererProcesses(file);
      state.sourcemap(file);
    }
  }

  private rowRenderer(
    { title, processId, isClient }: RendererDescription,
    { progress, result }: SleuthState['sourcemapState']
  ) {
    const isCompleted = !!result;
    const pending = !isCompleted && progress !== 0;

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
              icon='document-open'
            >
              Open Raw
            </Button>
            <Button
              onClick={() => this.setState({ profilePid: processId })}
              icon={
                pending ? (
                  <Spinner size={16} value={progress} />
                ) : (
                  'document-open'
                )
              }
              disabled={!isCompleted}
            >
              Open Sourcemapped
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

    const { rendererThreads, sourcemapState } = this.props.state;
    const hasThreads = !!rendererThreads?.length;
    const missingThreads = rendererThreads?.length === 0;
    const isLoading = !rendererThreads;

    return (
      <div className='ProcessTable'>
        <Card>
          <h1>Renderer Threads</h1>
          <HTMLTable>
            <thead>
              <tr>
                <th>Name</th>
                <th>PID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hasThreads &&
                rendererThreads?.map((thread) =>
                  this.rowRenderer(thread, sourcemapState)
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
      const {state} = this.props;
      const events = state.processRenderer(this.props.file, processId);

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