const fs = require('fs');
const path = require('path');

const publishFolder = path.resolve(__dirname, '..', 'out', 'publish-dry-run');

// Windows builds have backslashes in paths, but the publish is
// done with forward slashes.
for (const publishKey of fs.readdirSync(publishFolder)) {
  const publishRunDir = path.resolve(publishFolder, publishKey);

  for (const publishMetaKey of fs.readdirSync(publishRunDir)) {
    if (!publishMetaKey.endsWith('.forge.publish')) continue;

    const publishMetaPath = path.resolve(publishRunDir, publishMetaKey);

    const publishMeta = JSON.parse(fs.readFileSync(publishMetaPath, 'utf8'));
    publishMeta.artifacts = publishMeta.artifacts.map((s) =>
      s.replace(/\\/g, '/'),
    );
    fs.writeFileSync(publishMetaPath, JSON.stringify(publishMeta, null, 2));
  }
}
