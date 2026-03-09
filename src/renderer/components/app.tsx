import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import debug from 'debug';

import { ConfigProvider, theme } from 'antd';

const d = debug('sleuth:app');

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

  const sleuthStateRef = useRef<SleuthState | null>(null);

  const resetApp = useCallback(() => {
    const sleuth = sleuthStateRef.current;
    if (!sleuth) return;

    setUnzippedFiles([]);
    setOpenEmpty(false);

    if (sleuth.opened > 0) {
      sleuth.reset(false);
    }

    sleuth.opened = sleuth.opened + 1;
    sleuth.getSuggestions();
  }, []);

  const openFile = useCallback(
    async (url: string) => {
      resetApp();
      try {
        const files = await window.Sleuth.openFile(url);
        sleuthStateRef.current?.setSource(url);
        setUnzippedFiles(files);
      } catch (error) {
        d('Failed to open file:', url, error);
      }
    },
    [resetApp],
  );

  if (sleuthStateRef.current === null) {
    localStorage.debug = 'sleuth:*';
    sleuthStateRef.current = new SleuthState(openFile, resetApp);
  }
  const sleuthState = sleuthStateRef.current;

  useEffect(() => {
    window.Sleuth.sendWindowReady();

    // Setup file drop
    const preventHandler = (event: Event) => event.preventDefault();
    document.addEventListener('dragover', preventHandler);
    document.addEventListener('drop', preventHandler);

    const bodyDropHandler = (event: DragEvent) => {
      if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        let url = window.Sleuth.getPathForFile(event.dataTransfer.files[0]);
        url = url.replace('file:///', '/');
        openFile(url);
      }

      event.preventDefault();
    };
    document.body.addEventListener('drop', bodyDropHandler);

    const removeFileDrop = window.Sleuth.setupFileDrop((_event, url: string) =>
      openFile(url),
    );

    // Setup open sentry
    const removeOpenSentry = window.Sleuth.setupOpenSentry((event) => {
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
      document.removeEventListener('dragover', preventHandler);
      document.removeEventListener('drop', preventHandler);
      document.body.removeEventListener('drop', bodyDropHandler);
      removeFileDrop();
      removeOpenSentry();
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
