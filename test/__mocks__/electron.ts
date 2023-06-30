import path from 'path';

const ipcRenderer = {
  send: jest.fn(),
  invoke: jest.fn(),
};

const app = {
  getPath(target: string) {
    if (target === 'downloads') {
      return path.join(__dirname, '../static/');
    }

    return __dirname;
  }
};

const shell = {
  trashItem: jest.fn()
};


module.exports = { ipcRenderer, shell };
