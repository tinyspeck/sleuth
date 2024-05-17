import { normalize, join, relative } from 'path';
import { net, protocol } from 'electron';

export function registerSchemePrivilege() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'oop', privileges: { standard: true, supportFetchAPI: true } },
  ]);
}

/**
 * A custom oop scheme is used to force iframes (such as devtools)
 * to fail the same origin check, allowing them to be OOPIFs
 * protecting against Sleuth freezes
 */
export function registerScheme() {
  protocol.handle('oop', (request) => {
    const url = new URL(request.url);
    if (url.host !== 'oop') {
      // request did not match known path, cowardly refusing
      return new Response(null, { status: 400 });
    }

    const dist = normalize(`${__dirname}/../..`);
    const path = join(dist, url.pathname);

    const relation = relative(dist, path);
    if (relation.includes('..')) {
      // request appears to be try to be navigating outside of dist
      return new Response(null, { status: 400 });
    } else {
      return net.fetch(`file://${path}`);
    }
  });
}
