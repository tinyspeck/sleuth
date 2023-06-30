const ipcRenderer = {
  send: jest.fn(),
  invoke: jest.fn(),
};

const shell = {
  trashItem: jest.fn()
};


module.exports = { ipcRenderer, shell };
