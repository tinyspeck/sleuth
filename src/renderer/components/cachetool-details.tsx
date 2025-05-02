import { observer } from 'mobx-react';
import React from 'react';
import classNames from 'classnames';
import autoBind from 'react-autobind';
import {
  Card,
  Elevation,
  Tabs,
  Tab,
  Callout,
  Intent,
  Button,
  ButtonGroup,
} from '@blueprintjs/core';
import { autorun, IReactionDisposer } from 'mobx';

import { SleuthState } from '../state/sleuth';
import { IpcEvents } from '../../ipc-events';
import { ipcRenderer } from 'electron';

export interface CachetoolDetailsProps {
  state: SleuthState;
}

export interface CachetoolDetailsState {
  headers?: string;
  dataPath?: string;
}

@observer
export class CachetoolDetails extends React.Component<
  CachetoolDetailsProps,
  CachetoolDetailsState
> {
  private headerAutorunDispose: IReactionDisposer;
  private dataAutorunDispose: IReactionDisposer;

  constructor(props: CachetoolDetailsProps) {
    super(props);

    autoBind(this);

    this.headerAutorunDispose = autorun(async () => {
      const selectedCacheKey = this.props.state.selectedCacheKey;
      const cachePath = this.props.state.cachePath;
      const headers = await ipcRenderer.invoke(
        IpcEvents.CACHETOOL_GET_HEADERS,
        cachePath,
        selectedCacheKey,
      );

      this.setState({
        headers,
      });
    });

    this.dataAutorunDispose = autorun(async () => {
      const selectedCacheKey = this.props.state.selectedCacheKey;
      const cachePath = this.props.state.cachePath;
      const dataPath = await ipcRenderer.invoke(
        IpcEvents.CACHETOOL_GET_DATA,
        cachePath,
        selectedCacheKey,
      );

      this.setState({
        dataPath,
      });
    });
  }

  public componentWillUnmount() {
    this.headerAutorunDispose();
    this.dataAutorunDispose();
  }

  /**
   * Toggle the whole data view.
   */
  public toggle() {
    this.props.state.isDetailsVisible = !this.props.state.isDetailsVisible;
  }

  /**
   * Renders a single log entry, ensuring that people can scroll around and still now what log entry they're looking at.
   *
   * @param {string} key
   * @returns {(JSX.Element | null)}
   */
  public renderEntry(key: string): JSX.Element | null {
    return (
      <div className="Details-LogEntry">
        <Card
          className="Message Monospace"
          elevation={Elevation.THREE}
          style={{ overflowWrap: 'break-word' }}
        >
          {key}
        </Card>
        <Card elevation={Elevation.TWO}>
          <div style={{ float: 'right' }}>
            <ButtonGroup>
              <Button
                icon="download"
                onClick={() =>
                  ipcRenderer.invoke(
                    IpcEvents.CACHETOOL_DOWNLOAD,
                    this.state.dataPath,
                  )
                }
                text="Save File"
              />
              <Button icon="cross" onClick={this.toggle} text="Close" />
            </ButtonGroup>
          </div>
          <Tabs>
            <Tab id="headers" title="Headers" panel={this.renderHeaders()} />
            <Tab id="content" title="Content" panel={this.renderContent()} />
          </Tabs>
        </Card>
      </div>
    );
  }

  public renderHeaders() {
    return (
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {this.state.headers || 'Headers loading...'}
      </pre>
    );
  }

  public renderContent() {
    return (
      <>
        <Callout>
          <img style={{ maxWidth: '100%' }} src={this.state.dataPath} />
        </Callout>
        <br />
        <Callout intent={Intent.WARNING}>
          <p>
            We&apos;re blindly hoping that we&apos;re dealing with an image. If
            we&apos;re not, you might be able to open the file yourself with
            another program.
          </p>
        </Callout>
      </>
    );
  }

  public render(): JSX.Element | null {
    const { selectedCacheKey } = this.props.state;
    const { isDetailsVisible } = this.props.state;

    if (!isDetailsVisible) return null;

    const className = classNames('Details', { IsVisible: isDetailsVisible });
    const logEntryInfo = selectedCacheKey
      ? this.renderEntry(selectedCacheKey)
      : null;

    return <div className={className}>{logEntryInfo}</div>;
  }
}
