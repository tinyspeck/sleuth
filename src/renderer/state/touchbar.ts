import { autorun, toJS } from 'mobx';
import { ipcRenderer } from 'electron';

import { SleuthState } from './sleuth';
import { IpcEvents } from '../../ipc-events';
import { TouchBarLogFileUpdate } from '../../interfaces';
import { isProcessedLogFile, isLogFile } from '../../utils/is-logfile';

export function setupTouchBarAutoruns(state: SleuthState) {
  autorun(() => {
    ipcRenderer.send(IpcEvents.LEVEL_FILTER_UPDATE, toJS(state.levelFilter));
  });

  autorun(() => {
    const levelCounts = isProcessedLogFile(state.selectedLogFile)
      ? state.selectedLogFile.levelCounts
      : {};
    const options: TouchBarLogFileUpdate = {
      isLogFile: isLogFile(state.selectedLogFile),
      levelCounts,
    };

    ipcRenderer.send(IpcEvents.LOG_FILE_UPDATE, toJS(options));
  });
}
