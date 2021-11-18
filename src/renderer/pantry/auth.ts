import fetch from 'node-fetch';
import * as pty from 'node-pty';

import { config } from '../../config';
import { showMessageBox, getUserAgent } from '../ipc';

const debug = require('debug')('sleuth:pantry-auth');

export interface SigninOptions {
  silent: boolean;
}

export interface SigninInfo {
  uberProxyCookie: string;
}
export class PantryAuth {
  public signInUrl = config.pantryUrl;
  private cookie: string = '';
  private handler: (cookie: string, isSignedIn: boolean) => void;

  constructor() {
    this.signIn = this.signIn.bind(this);
  }

  setCookie(cookie: string) {
    this.cookie = cookie;
    this.signIn({ silent: true });
  }

  onAuthChange(handler: (cookie: string, isSignedIn: boolean) => void) {
    this.handler = handler;
  }

  private updateAuth(cookie: string, isSignedIn: boolean) {
    this.cookie = cookie;
    this.handler(cookie, isSignedIn);
  }

  public showSignInWindowWarning(): Promise<Electron.MessageBoxReturnValue> {
    const options: Electron.MessageBoxOptions = {
      type: 'info',
      buttons: ['Okay'],
      title: 'Sleuth tries to help',
      message: `In order to sourcemap traces, Sleuth will now authenticate with "Pantry" a service that stores sourcemaps. In a moment, you'll receive an authentication request on your device.`,
    };

    return showMessageBox(options);
  }

  public getUberproxyAuth(): Promise<boolean> {
    let resolved = false;
    return new Promise(async (resolve) => {
      const handleFailure = (error: any) => {
        if (!resolved) {
          debug('Unable to get uberproxy-auth', error);
          resolve(false);
        }
      };
      try {
        const cmd = pty.spawn(
          'slack',
          ['uberproxy-auth', '--user-agent', await getUserAgent()],
          {}
        );
        cmd.onData(async (data) => {
          if (data.includes('Passcode or option')) {
            await this.showSignInWindowWarning();
            cmd.write('1\r');
          } else {
            try {
              const authData = JSON.parse(data.trim());
              if (authData['user-agent']) {
                // looks like a valid response
                const cookies = Object.entries(authData).map(
                  ([key, val]) => `${key}=${val};`
                );
                this.updateAuth(cookies.join(' '), true);
                resolve(true);
                resolved = true;
              }
            } catch (e) {
              // ignored
            }
          }
        });
        cmd.onExit(handleFailure);
      } catch (e) {
        handleFailure(e);
      }
    });
  }

  public async signIn(options?: SigninOptions): Promise<boolean> {
    try {
      debug(`Trying to sign into Pantry`);
      const headers = {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': await getUserAgent(),
        Cookie: this.cookie,
      };

      const response = await fetch(this.signInUrl, { headers });
      const { url } = response;

      if (url.includes('slauth_login')) {
        if (options?.silent) {
          debug(`Pantry auth silently failing`);
          this.updateAuth('', false);
          return false;
        } else {
          debug(`Pantry auth failed, calling out to uberproxy auth`);
          const result = await this.getUberproxyAuth();
          return result;
        }
      } else {
        debug(`Received response from ${response.url}`);
        debug(`User is signed into pantry:`);

        this.updateAuth(this.cookie, true);
        return true;
      }
    } catch (error: unknown) {
      debug(`Tried sign into pantry, but failed`, error);
      return false;
    }
  }
}
