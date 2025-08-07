import React, { useState, useEffect, useCallback, useRef } from 'react';
import classNames from 'classnames';

import { ConfigProvider, theme } from 'antd';

import { Welcome } from './welcome';
import { CoreApplication } from './app-core';
import { MacTitlebar } from './mac-titlebar';
import { Preferences } from './preferences/preferences';
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

export const App = observer(() => {
  const [unzippedFiles, setUnzippedFiles] = useState<UnzippedFiles>([]);
  const [openEmpty, setOpenEmpty] = useState<boolean | undefined>();
  const sleuthStateRef = useRef<SleuthState | null>(null);

  // Define these functions first so they can be passed to SleuthState constructor
  const openFile = useCallback(async (url: string) => {
    resetApp();
    const files = await window.Sleuth.openFile(url);
    sleuthStateRef.current?.setSource(url);
    setUnzippedFiles(files);
  }, []);

  const resetApp = useCallback(() => {
    setUnzippedFiles([]);
    setOpenEmpty(false);

    if (sleuthStateRef.current && sleuthStateRef.current.opened > 0) {
      sleuthStateRef.current.reset(false);
    }

    if (sleuthStateRef.current) {
      sleuthStateRef.current.opened = sleuthStateRef.current.opened + 1;
      sleuthStateRef.current.getSuggestions();
    }
  }, []);

  // Initialize SleuthState on first render
  if (!sleuthStateRef.current) {
    localStorage.debug = 'sleuth:*';
    sleuthStateRef.current = new SleuthState(openFile, resetApp);
  }

  const setupFileDrop = useCallback(() => {
    document.ondragover = document.ondrop = (event) => event.preventDefault();
    document.body.ondrop = (event) => {
      if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        let url = window.Sleuth.getPathForFile(event.dataTransfer.files[0]);
        url = url.replace('file:///', '/');
        resetApp();
        openFile(url);
      }

      event.preventDefault();
    };

    return window.Sleuth.setupFileDrop((_event, url: string) => openFile(url));
  }, [openFile, resetApp]);

  const setupOpenSentry = useCallback(() => {
    return window.Sleuth.setupOpenSentry((event) => {
      // Get the file path to the installation file. Only app-* classes know.
      const installationFile = unzippedFiles?.find((file) => {
        return file.fileName === 'installation';
      });

      event.sender.send(IpcEvents.OPEN_SENTRY, installationFile?.fullPath);
    });
  }, [unzippedFiles]);

  const setupWindowTitle = useCallback(() => {
    return autorun(() => {
      document.title = getWindowTitle(sleuthStateRef.current?.source);
    });
  }, []);

  useEffect(() => {
    window.Sleuth.sendWindowReady();

    const fileDropCleanup = setupFileDrop();
    const openSentryCleanup = setupOpenSentry();
    const windowTitleDisposer = setupWindowTitle();

    return () => {
      fileDropCleanup && fileDropCleanup();
      openSentryCleanup && openSentryCleanup();
      windowTitleDisposer && windowTitleDisposer();
    };
  }, [setupFileDrop, setupOpenSentry, setupWindowTitle]);

  const className = classNames(
    'App',
    {
      // eslint-disable-next-line no-restricted-globals
      Darwin: window.Sleuth.platform === 'darwin',
    },
    'antd',
  );

  const titleBar =
    window.Sleuth.platform === 'darwin' ? (
      <MacTitlebar state={sleuthStateRef.current} />
    ) : (
      ''
    );

  const content =
    unzippedFiles && (unzippedFiles.length || openEmpty) ? (
      <CoreApplication
        state={sleuthStateRef.current}
        unzippedFiles={unzippedFiles}
      />
    ) : (
      <Welcome state={sleuthStateRef.current} />
    );

  if (!sleuthStateRef.current) return null;

  return (
    <ConfigProvider
      theme={{
        algorithm: sleuthStateRef.current.prefersDarkColors
          ? theme.darkAlgorithm
          : theme.defaultAlgorithm,
        cssVar: { key: 'antd' },
        token: {
          colorPrimary: '#137cbd',
          colorBgBase: sleuthStateRef.current.prefersDarkColors
            ? '#2f343c'
            : '#ffffff',
        },
      }}
    >
      <div className={className}>
        <Preferences state={sleuthStateRef.current} />
        {titleBar}
        {content}
      </div>
    </ConfigProvider>
  );
});
