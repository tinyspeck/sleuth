import React from 'react';
import { ipcRenderer } from 'electron';
import classNames from 'classnames';
import fs from 'fs-extra';
import path from 'path';
import debug from 'debug';
import { ConfigProvider, theme } from 'antd';

import { Unzipper } from '../unzip';
import { Welcome } from './welcome';
import { CoreApplication } from './app-core';
import { MacTitlebar } from './mac-titlebar';
import { Preferences } from './preferences';
import { sendWindowReady } from '../ipc';
import { openSentry } from '../sentry';
import { SleuthState } from '../state/sleuth';
import { shouldIgnoreFile } from '../../utils/should-ignore-file';
import { isCacheDir } from '../../utils/is-cache';
import { UnzippedFiles, UnzippedFile } from '../../interfaces';
import { autorun } from 'mobx';
import { getWindowTitle } from '../../utils/get-window-title';
import { IpcEvents } from '../../ipc-events';
import { observer } from 'mobx-react';

const d = debug('sleuth:app');

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

    localStorage.debug = 'sleuth*';

    this.openFile = this.openFile.bind(this);
    this.openDirectory = this.openDirectory.bind(this);
    this.resetApp = this.resetApp.bind(this);

    this.sleuthState = new SleuthState(this.openFile, this.resetApp);
  }

  /**
   * Alright, time to show the window!
   */
  public componentDidMount() {
    sendWindowReady();

    this.setupFileDrop();
    this.setupBusyResponse();
    this.setupOpenSentry();
    this.setupWindowTitle();
  }

  /**
   * Takes a rando string, quickly checks if it's a zip or not,
   * and either tries to open it as a file or as a folder. If
   * it's neither, we'll do nothing.
   *
   * @param {string} url
   * @returns {Promise<void>}
   */
  public async openFile(url: string): Promise<void> {
    d(`Received open-url for ${url}`);
    this.resetApp();

    let isInvalid = false;
    const stats = await fs.stat(url);
    const isZipFile = /[\s\S]*\.zip$/.test(url);

    if (isZipFile) {
      await this.openZip(url);
    } else if (stats.isDirectory()) {
      await this.openDirectory(url);
    } else if (stats.isFile()) {
      await this.openSingleFile(url);
    } else {
      isInvalid = true;
    }

    if (!isInvalid) {
      d(`Adding ${url} to recent documents`);
      ipcRenderer.send(IpcEvents.ADD_RECENT_FILE, url);
    }
  }

  /**
   * We were handed a single log file. We'll pretend it's an imaginary folder
   * with a single file in it.
   *
   * @param {string} url
   * @returns {Promise<void>}
   */
  public async openSingleFile(url: string): Promise<void> {
    d(`Now opening single file ${url}`);
    this.resetApp();

    console.groupCollapsed(`Open single file`);

    const stats = fs.statSync(url);
    const file: UnzippedFile = {
      fileName: path.basename(url),
      fullPath: url,
      size: stats.size,
      id: url,
      type: 'UnzippedFile',
    };

    this.sleuthState.setSource(url);
    this.setState({ unzippedFiles: [file] });

    console.groupEnd();
  }

  /**
   * Takes a folder url as a string and opens it.
   *
   * @param {string} url
   * @returns {Promise<void>}
   */
  public async openDirectory(url: string): Promise<void> {
    d(`Now opening directory ${url}`);
    this.resetApp();

    const dir = await fs.readdir(url);
    const unzippedFiles: UnzippedFiles = [];

    console.groupCollapsed(`Open directory`);

    if (isCacheDir(dir)) {
      console.log(`${url} is a cache directory`);
      this.sleuthState.cachePath = url;
      this.setState({ openEmpty: true });
    } else {
      // Not a cache?
      for (const fileName of dir) {
        if (!shouldIgnoreFile(fileName)) {
          const fullPath = path.join(url, fileName);
          const stats = fs.statSync(fullPath);
          const file: UnzippedFile = {
            fileName,
            fullPath,
            size: stats.size,
            id: fullPath,
            type: 'UnzippedFile',
          };

          d('Found file, adding to result.', file);
          unzippedFiles.push(file);
        }
      }
    }

    this.sleuthState.setSource(url);
    this.setState({ unzippedFiles });

    console.groupEnd();
  }

  /**
   * Takes a zip file url as a string and opens it.
   *
   * @param {string} url
   */
  public async openZip(url: string): Promise<void> {
    const unzipper = new Unzipper(url);
    await unzipper.open();

    const unzippedFiles = await unzipper.unzip();

    this.sleuthState.setSource(url);
    this.setState({ unzippedFiles });
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
      Darwin: process.platform === 'darwin',
    });
    const titleBar =
      process.platform === 'darwin' ? (
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
          algorithm: this.sleuthState.isDarkMode
            ? theme.darkAlgorithm
            : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#137cbd',
            colorBgBase: this.sleuthState.isDarkMode ? '#182026' : '#ffffff',
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
        let url = event.dataTransfer.files[0].path;
        url = url.replace('file:///', '/');
        this.openFile(url);
      }

      event.preventDefault();
    };

    ipcRenderer.on(IpcEvents.FILE_DROPPED, (_event: any, url: string) =>
      this.openFile(url),
    );
  }

  private setupOpenSentry() {
    ipcRenderer.on(IpcEvents.OPEN_SENTRY, () => {
      // Get the file path to the installation file. Only app-* classes know.
      const installationFile = this.state.unzippedFiles?.find((file) => {
        return file.fileName === 'installation';
      });

      // Then, let the utility handle the details
      openSentry(installationFile?.fullPath);
    });
  }

  /**
   * Sometimes, the main process wants to know whether or not this window is currently
   * handling a set of logfiles.
   */
  private setupBusyResponse() {
    ipcRenderer.on(IpcEvents.ARE_YOU_BUSY, (event) => {
      const { unzippedFiles } = this.state;

      event.returnValue = !(!unzippedFiles || unzippedFiles.length === 0);
    });
  }
}
