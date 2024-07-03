const fs = require('fs-extra');
const path = require('path');

module.exports = {
  async copyDevtoolsFrontend() {
    const basePath = path.join(
      __dirname,
      '../node_modules/devtools-frontend-prebuilt/front_end',
    );

    const copyOps = [
      {
        source: basePath,
        target: path.join(__dirname, '../dist/devtools-frontend'),
      },
      {
        source: path.join(__dirname, '../static/devtools-frontend.html'),
        target: path.join(__dirname, '../dist/static/devtools-frontend.html'),
      },
    ];

    for (const op of copyOps) {
      await fs.copy(op.source, op.target);
    }
  },
};
