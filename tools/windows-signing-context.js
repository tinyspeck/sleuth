const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const http = require("http");
const httpProxy = require("http-proxy");

async function withWindowsSigningContext(fn) {
  let server = null;
  let dir = null;
  try {
    server = await createTimestampProxyServer();
    dir = await fs.mkdtemp(path.resolve(os.tmpdir(), "slack-builder-folder-"));

    return await fn(server.proxiedTimestampUrl);
  } finally {
    if (dir) await fs.remove(dir);
    await new Promise((resolve, reject) => {
      if (!server) return resolve();
      server.timestampProxyServer.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

// Used for code-signing in CI
// Create an http-proxy pointing at digicert timestamp server
async function createTimestampProxyServer() {
  const timestampUrl = "http://timestamp.digicert.com";
  const timestampProxiedProxy = httpProxy.createProxyServer({});
  const timestampProxyServer = http.createServer((req, res) => {
    return timestampProxiedProxy.web(req, res, { target: timestampUrl });
  });
  await new Promise((resolve) => {
    timestampProxyServer.listen(0, () => resolve());
  });
  const timestampPort = timestampProxyServer.address().port;
  const proxiedTimestampUrl = `http://localhost:${timestampPort}`;

  return { timestampProxyServer, proxiedTimestampUrl };
}

module.exports = { withWindowsSigningContext };
