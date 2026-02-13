import { spawn } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';

const CERTIFICATE_PATH =
  process.env.CERTIFICATE_PATH ?? 'C:\\setup\\certificates\\full-chain.pem';
const KMS_REGION = process.env.KMS_REGION ?? 'us-east-1';
const KMS_ALIAS = process.env.KMS_ALIAS ?? 'alias/code-signing';
const TIMESTAMP_URL =
  process.env.TIMESTAMP_URL ?? 'http://timestamp.digicert.com';

export interface SigningResult {
  success: boolean;
  file: string;
  error?: string;
}

export async function signFileWithJsign(
  filePath: string,
): Promise<SigningResult> {
  const normalizedPath = path.normalize(filePath);

  if (!fs.existsSync(normalizedPath)) {
    return {
      success: false,
      file: normalizedPath,
      error: `File does not exist: ${normalizedPath}`,
    };
  }

  if (!fs.existsSync(CERTIFICATE_PATH)) {
    return {
      success: false,
      file: normalizedPath,
      error: `Certificate not found: ${CERTIFICATE_PATH}`,
    };
  }

  const jsignArgs = [
    '--storetype',
    'AWS',
    '--keystore',
    KMS_REGION,
    '--alias',
    KMS_ALIAS,
    '--certfile',
    CERTIFICATE_PATH,
    '--tsaurl',
    TIMESTAMP_URL,
    '--replace',
    normalizedPath,
  ];

  return new Promise((resolve) => {
    console.log(`Signing ${path.basename(normalizedPath)} with jsign...`);

    const jsign = spawn('jsign', jsignArgs);

    let stdout = '';
    let stderr = '';

    jsign.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    jsign.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    jsign.on('close', (code) => {
      if (code === 0) {
        console.log(`Successfully signed: ${path.basename(normalizedPath)}`);
        resolve({ success: true, file: normalizedPath });
      } else {
        const errorMsg = `Jsign failed with exit code ${code}: ${
          stderr || stdout
        }`;
        console.error(
          `Failed to sign ${path.basename(normalizedPath)}: ${errorMsg}`,
        );
        resolve({ success: false, file: normalizedPath, error: errorMsg });
      }
    });

    jsign.on('error', (error) => {
      console.error(`Failed to spawn jsign:`, error);
      resolve({
        success: false,
        file: normalizedPath,
        error: `Failed to spawn jsign: ${error.message}`,
      });
    });
  });
}

export async function signFilesWithJsign(
  filePaths: string[],
): Promise<SigningResult[]> {
  const results: SigningResult[] = [];

  for (const filePath of filePaths) {
    const result = await signFileWithJsign(filePath);
    results.push(result);

    // Brief delay between signing operations
    if (filePaths.indexOf(filePath) < filePaths.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

export function shouldSign(): boolean {
  return process.env.CI === 'true' && process.platform === 'win32';
}
