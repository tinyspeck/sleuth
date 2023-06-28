import { autorun, toJS } from 'mobx';
import { ipcRenderer } from 'electron';

import { SleuthState } from './sleuth';
import { TOUCHBAR_IPC } from '../../ipc-events';
import { TouchBarLogFileUpdate } from '../../interfaces';
import { isProcessedLogFile, isLogFile } from '../../utils/is-logfile';

export function setupTouchBarAutoruns(state: SleuthState) {
  autorun(() => {
    ipcRenderer.send(TOUCHBAR_IPC.LEVEL_FILTER_UPDATE, toJS(state.levelFilter));
  });

  autorun(() => {
    ipcRenderer.send(TOUCHBAR_IPC.DARK_MODE_UPDATE, toJS(state.isDarkMode));
  });

  autorun(() => {
    const levelCounts = isProcessedLogFile(state.selectedLogFile)
      ? state.selectedLogFile.levelCounts
      : {};
    const options: TouchBarLogFileUpdate = {
      isLogFile: isLogFile(state.selectedLogFile),
      levelCounts
    };

    ipcRenderer.send(TOUCHBAR_IPC.LOG_FILE_UPDATE, toJS(options));
  });
}
