import { vi } from 'vitest';

const ipcRenderer = {
  send: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};

const shell = {
  trashItem: vi.fn(),
};

module.exports = { ipcRenderer, shell };
