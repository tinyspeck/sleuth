import React from 'react';
import classNames from 'classnames';

import { ConfigProvider, theme } from 'antd';

import { Welcome } from './welcome';
import { CoreApplication } from './app-core';
import { MacTitlebar } from './mac-titlebar';
import { Preferences } from './preferences';
import { SleuthState } from '../state/sleuth';
import { UnzippedFiles } from '../../interfaces';
import { autorun } from 'mobx';
import { getWindowTitle } from '../../utils/get-window-title';
import { IpcEvents } from '../../ipc-events';
import { observer } from 'mobx-react';

export interface AppState {
  unzippedFiles: UnzippedFiles;
  openEmpty?: boolean;
}

@observer
export class App extends React.Component<object, Partial<AppState>> {
  public readonly sleuthState: SleuthState;

  constructor(props: object) {
    super(props);

    this.state = {
      unzippedFiles: [],
    };

    localStorage.debug = 'sleuth:*';

    this.openFile = this.openFile.bind(this);
    this.resetApp = this.resetApp.bind(this);
    this.sleuthState = new SleuthState(this.openFile, this.resetApp);
  }

  /**
   * Alright, time to show the window!
   */
  public componentDidMount() {
    window.Sleuth.sendWindowReady();

    this.setupFileDrop();
    this.setupOpenSentry();
    this.setupWindowTitle();
  }

  public resetApp() {
    this.setState({ unzippedFiles: [], openEmpty: false });

    if (this.sleuthState.opened > 0) {
      this.sleuthState.reset(false);
    }

    this.sleuthState.opened = this.sleuthState.opened + 1;
    this.sleuthState.getSuggestions();
  }

  /**
   * Let's render this!
   *
   * @returns {JSX.Element}
   */
  public render(): JSX.Element {
    const { unzippedFiles, openEmpty } = this.state;
    const className = classNames('App', {
      // eslint-disable-next-line no-restricted-globals
      Darwin: window.Sleuth.platform === 'darwin',
    });
    const titleBar =
      window.Sleuth.platform === 'darwin' ? (
        <MacTitlebar state={this.sleuthState} />
      ) : (
        ''
      );
    const content =
      unzippedFiles && (unzippedFiles.length || openEmpty) ? (
        <CoreApplication
          state={this.sleuthState}
          unzippedFiles={unzippedFiles}
        />
      ) : (
        <Welcome state={this.sleuthState} />
      );

    return (
      <ConfigProvider
        theme={{
          algorithm: this.sleuthState.prefersDarkColors
            ? theme.darkAlgorithm
            : theme.defaultAlgorithm,
          cssVar: true,
          token: {
            colorPrimary: '#137cbd',
            colorBgBase: this.sleuthState.prefersDarkColors
              ? '#182026'
              : '#ffffff',
          },
        }}
      >
        <div className={className}>
          <Preferences state={this.sleuthState} />
          {titleBar}
          {content}
        </div>
      </ConfigProvider>
    );
  }

  /**
   * Automatically update the Window title
   */
  private setupWindowTitle() {
    autorun(() => {
      document.title = getWindowTitle(this.sleuthState.source);
    });
  }

  /**
   * Whenever a file is dropped into the window, we'll try to open it
   */
  private setupFileDrop() {
    document.ondragover = document.ondrop = (event) => event.preventDefault();
    document.body.ondrop = (event) => {
      if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        let url = window.Sleuth.getPathForFile(event.dataTransfer.files[0]);
        url = url.replace('file:///', '/');
        this.openFile(url);
      }

      event.preventDefault();
    };

    window.Sleuth.setupFileDrop((_event, url: string) => this.openFile(url));
  }

  private setupOpenSentry() {
    window.Sleuth.setupOpenSentry((event) => {
      // Get the file path to the installation file. Only app-* classes know.
      const installationFile = this.state.unzippedFiles?.find((file) => {
        return file.fileName === 'installation';
      });

      event.sender.send(IpcEvents.OPEN_SENTRY, installationFile?.fullPath);
    });
  }

  private async openFile(url: string) {
    const files = await window.Sleuth.openFile(url);
    this.sleuthState.setSource(url);
    this.setState({ unzippedFiles: files });
  }
}
