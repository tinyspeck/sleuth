const fs = require('fs-extra');
const path = require('path');

module.exports = {
  async copyDevtoolsFrontend() {
    const basePath = path.join(
      __dirname,
      '../node_modules/devtools-frontend-prebuilt/front_end',
    );
    const hasSubmodules = fs.existsSync(basePath);
    const isCI = process.env.CI;

    if (!hasSubmodules && isCI) {
      throw new Error('Devtools Frontend missing');
    } else if (!hasSubmodules) {
      console.warn(`Building WITHOUT Devtools Frontend!`);
    }

    const gitSubmodules = hasSubmodules
      ? [
          {
            source: basePath,
            target: path.join(__dirname, '../dist/devtools-frontend'),
          },
        ]
      : [];

    const copyOps = [
      ...gitSubmodules,
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
