import { ipcRenderer } from 'electron';
import { ICON_NAMES } from '../shared-constants';
import { IpcEvents } from '../ipc-events';

// This file handles sending IPC events. Other classes might
// listen to IPC events.


type name = 'home' | 'appData' | 'userData' | 'cache' | 'temp' | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'logs';
export function getPath(
  path: name
): Promise<string> {
  return ipcRenderer.invoke(IpcEvents.GET_PATH, path);
}

export function getUserAgent(): Promise<string> {
  return ipcRenderer.invoke(IpcEvents.GET_USER_AGENT);
}

export function sendWindowReady() {
  ipcRenderer.send(IpcEvents.WINDOW_READY);
}

export function sendDoubleClick(){
  ipcRenderer.send(IpcEvents.CLICK_TITLEBAR_MAC);
}

export function showOpenDialog(): Promise<Electron.OpenDialogReturnValue> {
  return ipcRenderer.invoke(IpcEvents.SHOW_OPEN_DIALOG);
}

export function showSaveDialog(filename: string): Promise<Electron.SaveDialogReturnValue> {
  return ipcRenderer.invoke(IpcEvents.SHOW_SAVE_DIALOG, filename);
}

export function showMessageBox(
  options: Electron.MessageBoxOptions
): Promise<Electron.MessageBoxReturnValue> {
  return ipcRenderer.invoke(IpcEvents.MESSAGE_BOX, options);
}

export function changeIcon(iconName: ICON_NAMES) {
  return ipcRenderer.invoke(IpcEvents.CHANGE_ICON, iconName);
}