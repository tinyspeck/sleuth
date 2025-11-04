import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';

import { logFileList } from './filesystem/open-file';

/**
 * Register custom protocol schemes.
 */
export function registerScheme() {
  /**
   * Custom protocol scheme for loading log files that were loaded
   * via the `openFile` function. Block any request that is not explicitly
   * in that allowlist.
   */
  protocol.handle('logfile', (request) => {
    const url = new URL(request.url);
    if (logFileList.map((file) => file.fullPath).includes(url.pathname)) {
      return net.fetch(pathToFileURL(url.pathname).href);
    } else {
      return new Response(null, { status: 400 });
    }
  });
}
