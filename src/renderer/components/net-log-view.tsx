import React, { useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import debug from 'debug';

import { SleuthState } from '../state/sleuth';
import { autorun, IReactionDisposer } from 'mobx';
import { UnzippedFile } from '../../interfaces';

export interface NetLogViewProps {
  state: SleuthState;
  file: UnzippedFile;
}

const d = debug('sleuth:netlogview');

export const NetLogView = observer((props: NetLogViewProps) => {
  const disposeDarkModeAutorunRef = useRef<IReactionDisposer | undefined>();

  /**
   * We have a little bit of css in catapult.html that'll enable a
   * basic dark mode.
   *
   * @param {boolean} enabled
   */
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

  /**
   * Loads the currently selected file in catapult
   */
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

    disposeDarkModeAutorunRef.current = autorun(() => {
      const isDarkMode = props.state.prefersDarkColors;
      setDarkMode(isDarkMode);
    });
  }, [props.file, props.state.prefersDarkColors, setDarkMode]);

  // Component will unmount
  useEffect(() => {
    return () => {
      if (disposeDarkModeAutorunRef.current) {
        disposeDarkModeAutorunRef.current();
      }
    };
  }, []);

  return (
    <div className="NetLogView">
      <iframe src="catapult.html" onLoad={loadFile} frameBorder={0} />
    </div>
  );
});
