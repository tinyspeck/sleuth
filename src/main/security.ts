import { app } from 'electron';
import { URL } from 'url';
import { createLogger } from './log';

const log = createLogger('Security');

/**
 * Attempts to secure the app by disallowing things we do
 * not need.
 *
 * @export
 */
export function secureApp() {
  app.on('web-contents-created', (_event, webContents) => {
    // Disallow navigation
    webContents.on('will-navigate', (event, url) => {
      const parsedUrl = new URL(url);

      const isSlack = parsedUrl.hostname.endsWith('slack.com');
      const isOkta = parsedUrl.hostname.endsWith('okta.com');
      const isFile = parsedUrl.protocol === 'file:';

      if (!isSlack && !isOkta && !isFile) {
        log.warn(`Prevented navigation to ${url}`);
        log.info(`Hostname: ${parsedUrl.hostname}`);
        event.preventDefault();
      }
    });
  });
}
