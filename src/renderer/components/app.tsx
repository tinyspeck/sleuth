import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const [openEmpty, setOpenEmpty] = useState(false);

  const unzippedFilesRef = useRef<UnzippedFiles>([]);
  unzippedFilesRef.current = unzippedFiles;

  const openFile = useCallback(async (url: string) => {
    setUnzippedFiles([]);
    setOpenEmpty(false);
    sleuthStateRef.current.opened = sleuthStateRef.current.opened + 1;
    sleuthStateRef.current.getSuggestions();

    if (sleuthStateRef.current.opened > 1) {
      sleuthStateRef.current.reset(false);
    }

    const files = await window.Sleuth.openFile(url);
    sleuthStateRef.current.setSource(url);
    setUnzippedFiles(files);
  }, []);

  const resetApp = useCallback(() => {
    setUnzippedFiles([]);
    setOpenEmpty(false);

    if (sleuthStateRef.current.opened > 0) {
      sleuthStateRef.current.reset(false);
    }

    sleuthStateRef.current.opened = sleuthStateRef.current.opened + 1;
    sleuthStateRef.current.getSuggestions();
  }, []);

  const sleuthStateRef = useRef<SleuthState>(null!);
  if (sleuthStateRef.current === null) {
    localStorage.debug = 'sleuth:*';
    sleuthStateRef.current = new SleuthState(openFile, resetApp);
  }
  const sleuthState = sleuthStateRef.current;

  useEffect(() => {
    window.Sleuth.sendWindowReady();

    // Setup file drop
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

    window.Sleuth.setupFileDrop((_event, url: string) => openFile(url));

    // Setup open sentry
    window.Sleuth.setupOpenSentry((event) => {
      const installationFile = unzippedFilesRef.current?.find((file) => {
        return file.fileName === 'installation';
      });

      event.sender.send(IpcEvents.OPEN_SENTRY, installationFile?.fullPath);
    });

    // Setup window title
    const disposeAutorun = autorun(() => {
      document.title = getWindowTitle(sleuthState.source);
    });

    return () => {
      disposeAutorun();
    };
  }, [openFile, resetApp, sleuthState]);

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
      <MacTitlebar state={sleuthState} />
    ) : (
      ''
    );
  const content =
    unzippedFiles && (unzippedFiles.length || openEmpty) ? (
      <CoreApplication state={sleuthState} unzippedFiles={unzippedFiles} />
    ) : (
      <Welcome state={sleuthState} />
    );

  return (
    <ConfigProvider
      theme={{
        algorithm: sleuthState.prefersDarkColors
          ? theme.darkAlgorithm
          : theme.defaultAlgorithm,
        cssVar: { key: 'antd' },
        token: {
          colorPrimary: '#137cbd',
          colorBgBase: sleuthState.prefersDarkColors ? '#2f343c' : '#ffffff',
        },
      }}
    >
      <div className={className}>
        <Preferences state={sleuthState} />
        {titleBar}
        {content}
      </div>
    </ConfigProvider>
  );
});
