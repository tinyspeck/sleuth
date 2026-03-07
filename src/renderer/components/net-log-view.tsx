import React, { useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import debug from 'debug';

import { SleuthState } from '../state/sleuth';
import { autorun } from 'mobx';
import { UnzippedFile } from '../../interfaces';

export interface NetLogViewProps {
  state: SleuthState;
  file: UnzippedFile;
}

const d = debug('sleuth:netlogview');

export const NetLogView = observer((props: NetLogViewProps) => {
  const disposerRef = useRef<(() => void) | undefined>();

  const setDarkMode = useCallback((enabled: boolean) => {
    try {
      const iframe = document.getElementsByTagName('iframe');

      if (iframe && iframe.length > 0) {
        const catapultWindow = iframe[0].contentWindow;

        catapultWindow?.postMessage(
          {
            instruction: 'dark-mode',
            payload: enabled,
          },
          window.location.href,
        );
      }
    } catch (error) {
      d(`Failed to set dark mode`, error);
    }
  }, []);

  const loadFile = useCallback(async () => {
    d(`iFrame loaded`);

    const { file } = props;
    const iframe = document.getElementsByTagName('iframe');

    if (iframe && iframe[0]) {
      try {
        const catapultWindow = iframe[0].contentWindow;
        const raw = await window.Sleuth.readAnyFile(file);

        // See catapult.html for the postMessage handler
        catapultWindow?.postMessage(
          {
            instruction: 'load',
            payload: { fileName: file.fileName, content: raw },
          },
          window.location.href,
        );
      } catch (error) {
        d(`Failed to read file and load contents in catapult`, error);
      }
    }

    disposerRef.current = autorun(() => {
      const isDarkMode = props.state.prefersDarkColors;
      setDarkMode(isDarkMode);
    });
  }, [props, setDarkMode]);

  useEffect(() => {
    return () => {
      if (disposerRef.current) {
        disposerRef.current();
      }
    };
  }, []);

  return (
    <div className="NetLogView">
      <iframe src="catapult.html" onLoad={loadFile} frameBorder={0} />
    </div>
  );
});
