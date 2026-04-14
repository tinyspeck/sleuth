import { autorun, toJS } from 'mobx';

import { SleuthState } from './sleuth';
import { TouchBarLogFileUpdate } from '../../interfaces';
import { isProcessedLogFile, isLogFile } from '../../utils/is-logfile';

export function setupTouchBarAutoruns(state: SleuthState) {
  autorun(() => {
    window.Sleuth.levelFilterUpdate(toJS(state.levelFilter));
  });

  autorun(() => {
    const levelCounts = isProcessedLogFile(state.selectedFile)
      ? state.selectedFile.levelCounts
      : {};
    const options: TouchBarLogFileUpdate = {
      isLogFile: isLogFile(state.selectedFile),
      levelCounts,
    };

    window.Sleuth.logFileUpdate(toJS(options));
  });
}
