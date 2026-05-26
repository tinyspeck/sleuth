import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { getFmaRole } from './ai-config';

const execFileAsync = promisify(execFile);

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration?: Date;
}

let cachedCredentials: AwsCredentials | null = null;
let cacheExpiresAt = 0;

/**
 * Parse the shell `export` output from `fma-sso-assume-role print`
 * into structured credentials.
 */
function parseCredentialOutput(stdout: string): AwsCredentials {
  const vars: Record<string, string> = {};
  for (const line of stdout.split('\n')) {
    // Lines look like: export AWS_ACCESS_KEY_ID="ASIA..."
    const match = line.match(/^export\s+(\w+)="?([^"]*)"?$/);
    if (match) {
      vars[match[1]] = match[2];
    }
  }

  const accessKeyId = vars.AWS_ACCESS_KEY_ID;
  const secretAccessKey = vars.AWS_SECRET_ACCESS_KEY;
  const sessionToken = vars.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey || !sessionToken) {
    throw new Error('AWS_SSO_AUTH_REQUIRED');
  }

  return { accessKeyId, secretAccessKey, sessionToken };
}

/**
 * Get AWS credentials by running `fma-sso-assume-role print`.
 * Credentials are cached for 10 minutes.
 */
export async function getAwsCredentials(): Promise<AwsCredentials> {
  if (cachedCredentials && Date.now() < cacheExpiresAt) {
    return cachedCredentials;
  }

  try {
    const { stdout } = await execFileAsync(
      'fma-sso-assume-role',
      ['print', `--fma-role=${getFmaRole()}`],
      { timeout: 10_000 },
    );

    const creds = parseCredentialOutput(stdout);
    cachedCredentials = creds;
    // Cache for 12 hours (matching slack-claude behavior)
    cacheExpiresAt = Date.now() + 12 * 60 * 60 * 1000;
    return creds;
  } catch (error) {
    // Clear cache on failure
    cachedCredentials = null;
    cacheExpiresAt = 0;

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('ENOENT') || msg.includes('not found')) {
      throw new Error('AWS_SSO_NOT_INSTALLED');
    }

    // Any failure likely means auth is required
    throw new Error('AWS_SSO_AUTH_REQUIRED');
  }
}

/**
 * Open the SSO login flow in the user's browser by running
 * `fma-sso-assume-role print --refresh-cache` which forces re-auth.
 * Returns the credentials once login completes.
 */
export function startSsoLogin(): Promise<AwsCredentials> {
  return new Promise((resolve, reject) => {
    // --refresh-cache forces a new browser auth flow
    const child = spawn(
      'fma-sso-assume-role',
      ['print', `--fma-role=${getFmaRole()}`, '--refresh-cache'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const creds = parseCredentialOutput(stdout);
          cachedCredentials = creds;
          cacheExpiresAt = Date.now() + 12 * 60 * 60 * 1000;
          resolve(creds);
        } catch (parseError) {
          reject(parseError);
        }
      } else {
        reject(new Error(`SSO login failed (exit ${code}): ${stderr}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start SSO login: ${err.message}`));
    });
  });
}

/**
 * Cheap check that the AI feature can be _attempted_:
 *   1. `fma-sso-assume-role` is on PATH
 *   2. an `fmaRole` is configured
 *
 * Does NOT touch SSO state, so it's safe to call on every launch — we
 * don't want to prompt for AWS auth unless the user actually opens the
 * assistant.
 */
export async function checkAiInstalled(): Promise<boolean> {
  if (!getFmaRole()) return false;

  try {
    await execFileAsync('which', ['fma-sso-assume-role'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the AI feature is fully usable: the binary is installed,
 * SSO has authenticated, and the required role is listed. This shells out
 * to `fma-sso-assume-role list`, which requires a valid SSO session — so
 * only invoke it on user intent (e.g. clicking the assistant button).
 */
export async function checkAiAvailable(): Promise<boolean> {
  const roleShort = getFmaRole().split('/')[1] ?? '';
  if (!roleShort) return false;

  try {
    const { stdout } = await execFileAsync('fma-sso-assume-role', ['list'], {
      timeout: 10_000,
    });
    return stdout.includes(roleShort);
  } catch {
    return false;
  }
}

/**
 * Invalidate the cached credentials, forcing a fresh fetch on the next call.
 */
export function clearCredentialCache(): void {
  cachedCredentials = null;
  cacheExpiresAt = 0;
}
