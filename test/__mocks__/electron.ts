const ipcRenderer = {
  send: jest.fn(),
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

const shell = {
  trashItem: jest.fn(),
};

module.exports = { ipcRenderer, shell };
